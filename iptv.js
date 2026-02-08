// ==Lampa==
// name: IPTV PRO SAFE
// version: 12.0
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent() {
        var root, colG, colC;
        var groups = {};
        var channels = [];
        var current = [];
        var active = 'groups';
        var gi = 0, ci = 0;

        var KEY = 'iptv_safe_v12';
        var cfg = Lampa.Storage.get(KEY, {
            playlists: [{
                name: 'MEGA',
                url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'
            }],
            fav: [],
            pl: 0
        });

        function save() {
            Lampa.Storage.set(KEY, cfg);
        }

        function isFav(url) {
            for (var i = 0; i < cfg.fav.length; i++) {
                if (cfg.fav[i].url === url) return true;
            }
            return false;
        }

        function toggleFav(ch) {
            var i;
            for (i = 0; i < cfg.fav.length; i++) {
                if (cfg.fav[i].url === ch.url) {
                    cfg.fav.splice(i, 1);
                    save();
                    return;
                }
            }
            cfg.fav.push(ch);
            save();
        }

        this.create = function () {
            root = $('<div style="display:flex;height:100%;background:#0b0d10"></div>');
            colG = $('<div style="width:25%;overflow:auto"></div>');
            colC = $('<div style="flex:1;overflow:auto"></div>');
            root.append(colG).append(colC);
            this.load();
            return root;
        };

        this.load = function () {
            var p = cfg.playlists[cfg.pl];
            $.get(p.url, function (txt) {
                parse(txt);
            });
        };

        function parse(txt) {
            groups = { '⭐ Избранное': cfg.fav };
            channels = [];

            var lines = txt.split('\n');
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].indexOf('#EXTINF') === 0) {
                    var name = lines[i].split(',').pop();
                    var g = 'ОБЩИЕ';
                    var m = lines[i].match(/group-title="([^"]+)"/);
                    if (m) g = m[1];
                    var url = lines[i + 1];
                    if (url && url.indexOf('http') === 0) {
                        var ch = { name: name, url: url, group: g };
                        channels.push(ch);
                        if (!groups[g]) groups[g] = [];
                        groups[g].push(ch);
                    }
                }
            }
            renderGroups();
        }

        function renderGroups() {
            colG.empty();
            for (var g in groups) {
                colG.append('<div class="iptv-item">' + g + '</div>');
            }
            update();
        }

        function renderChannels(list) {
            current = list;
            colC.empty();
            for (var i = 0; i < list.length; i++) {
                var t = (isFav(list[i].url) ? '⭐ ' : '') + list[i].name;
                colC.append('<div class="iptv-item">' + t + '</div>');
            }
            active = 'channels';
            ci = 0;
            update();
        }

        function update() {
            $('.iptv-item').removeClass('active');
            if (active === 'groups')
                colG.find('.iptv-item').eq(gi).addClass('active');
            else
                colC.find('.iptv-item').eq(ci).addClass('active');
        }

        this.start = function () {
            Lampa.Controller.add('iptv_safe', {
                up: function () {
                    if (active === 'groups') gi = Math.max(0, gi - 1);
                    else ci = Math.max(0, ci - 1);
                    update();
                },
                down: function () {
                    if (active === 'groups') gi++;
                    else ci++;
                    update();
                },
                right: function () {
                    if (active === 'groups') {
                        var g = Object.keys(groups)[gi];
                        renderChannels(groups[g]);
                    }
                },
                enter: function () {
                    if (active === 'channels' && current[ci]) {
                        Lampa.Player.play({
                            url: current[ci].url,
                            title: current[ci].name
                        });
                    }
                },
                hold: function () {
                    if (active === 'channels' && current[ci]) {
                        toggleFav(current[ci]);
                        renderChannels(current);
                    }
                },
                back: function () {
                    if (active === 'channels') {
                        active = 'groups';
                        update();
                    } else {
                        Lampa.Activity.back();
                    }
                }
            });
            Lampa.Controller.toggle('iptv_safe');
        };

        this.render = function () { return root; };
        this.destroy = function () {
            Lampa.Controller.remove('iptv_safe');
            root.remove();
        };
    }

    function init() {
        Lampa.Component.add('iptv_safe', IPTVComponent);
        var li = $('<li class="menu__item selector"><div class="menu__text">IPTV PRO</div></li>');
        li.on('hover:enter', function () {
            Lampa.Activity.push({ title: 'IPTV', component: 'iptv_safe' });
        });
        $('.menu .menu__list').append(li);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') init();
    });
})();
