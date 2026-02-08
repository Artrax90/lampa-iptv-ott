// ==Lampa==
// name: IPTV PRO Stable
// version: 11.3
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent() {
        var _this = this;
        var root, colG, colC;
        var groups = {};
        var all = [];
        var list = [];
        var active = 'groups';
        var gi = 0, ci = 0;

        var STORE = 'iptv_pro_stable';

        var cfg = Lampa.Storage.get(STORE, {
            playlists: [{
                name: 'MEGA',
                url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'
            }],
            current: 0
        });

        /* ===== UI ===== */

        this.create = function () {
            root = $('<div class="iptv-root"><div class="iptv-wrap"></div></div>');
            colG = $('<div class="iptv-col groups"></div>');
            colC = $('<div class="iptv-col channels"></div>');
            root.find('.iptv-wrap').append(colG, colC);

            if (!$('#iptv-stable-style').length) {
                $('head').append(`
                <style id="iptv-stable-style">
                .iptv-root{position:fixed;inset:0;background:#0b0d10;z-index:1000;padding-top:5rem}
                .iptv-wrap{display:flex;height:100%}
                .iptv-col{overflow-y:auto}
                .groups{width:22rem;background:#0e1014}
                .channels{flex:1}
                .item{padding:1rem;margin:.4rem;border-radius:.5rem;background:rgba(255,255,255,.04);color:#fff}
                .item.active{background:#2962ff}
                .btn{margin:1rem;padding:1rem;text-align:center;border-radius:.5rem;background:#2962ff}
                .btn.gray{background:#444}
                </style>`);
            }

            this.load();
            return root;
        };

        /* ===== DATA ===== */

        this.load = function () {
            var pl = cfg.playlists[cfg.current];
            $.ajax({
                url: pl.url,
                success: function (t) { _this.parse(t); },
                error: function () { Lampa.Noty.show('Ошибка плейлиста'); }
            });
        };

        this.parse = function (txt) {
            groups = {};
            all = [];
            var lines = txt.split('\n');

            for (var i = 0; i < lines.length; i++) {
                if (lines[i].indexOf('#EXTINF') === 0) {
                    var name = (lines[i].match(/,(.*)$/) || [, ''])[1];
                    var grp = (lines[i].match(/group-title="([^"]+)"/) || [, 'ОБЩИЕ'])[1];
                    var url = (lines[i + 1] || '').trim();

                    if (url.indexOf('http') === 0) {
                        var ch = { name: name, url: url };
                        all.push(ch);
                        groups[grp] = groups[grp] || [];
                        groups[grp].push(ch);
                    }
                }
            }

            this.renderGroups();
        };

        /* ===== RENDER ===== */

        this.renderGroups = function () {
            colG.empty();

            $('<div class="btn">➕ Добавить плейлист</div>')
                .on('click', this.addPlaylist)
                .appendTo(colG);

            $('<div class="btn gray">🔍 Поиск</div>')
                .on('click', this.search)
                .appendTo(colG);

            Object.keys(groups).forEach(function (g, i) {
                $('<div class="item">' + g + '</div>')
                    .on('click', function () {
                        gi = i;
                        active = 'groups';
                        _this.renderChannels(groups[g]);
                    })
                    .appendTo(colG);
            });

            this.focus();
        };

        this.renderChannels = function (arr) {
            colC.empty();
            list = arr || [];
            list.forEach(function (c) {
                $('<div class="item">' + c.name + '</div>')
                    .on('click', function () {
                        Lampa.Player.play({ url: c.url, title: c.name });
                    })
                    .appendTo(colC);
            });
            active = 'channels';
            ci = 0;
            this.focus();
        };

        /* ===== SEARCH ===== */

        this.search = function () {
            Lampa.Input.show({
                title: 'Поиск канала',
                free: true,
                onEnter: function (q) {
                    if (!q) return;
                    _this.renderChannels(all.filter(function (c) {
                        return c.name.toLowerCase().indexOf(q.toLowerCase()) !== -1;
                    }));
                }
            });
        };

        /* ===== PLAYLISTS ===== */

        this.addPlaylist = function () {
            Lampa.Input.show({
                title: 'URL плейлиста',
                free: true,
                onEnter: function (url) {
                    if (!url || url.indexOf('http') !== 0) return;
                    cfg.playlists.push({
                        name: 'Playlist ' + cfg.playlists.length,
                        url: url
                    });
                    cfg.current = cfg.playlists.length - 1;
                    Lampa.Storage.set(STORE, cfg);
                    _this.load();
                }
            });
        };

        /* ===== CONTROLLER ===== */

        this.start = function () {
            Lampa.Controller.add('iptv_stable', {
                up: function () {
                    if (active === 'groups') gi = Math.max(0, gi - 1);
                    else ci = Math.max(0, ci - 1);
                    _this.focus();
                },
                down: function () {
                    if (active === 'groups') gi++;
                    else ci++;
                    _this.focus();
                },
                left: function () {
                    if (active === 'channels') active = 'groups';
                    else Lampa.Activity.back();
                    _this.focus();
                },
                right: function () {
                    if (active === 'groups') {
                        _this.renderChannels(groups[Object.keys(groups)[gi]]);
                    }
                },
                enter: function () {
                    if (active === 'channels') {
                        var c = list[ci];
                        if (c) Lampa.Player.play({ url: c.url, title: c.name });
                    }
                },
                back: function () {
                    Lampa.Activity.back();
                }
            });
            Lampa.Controller.toggle('iptv_stable');
        };

        this.focus = function () {
            $('.item').removeClass('active');
            if (active === 'groups') colG.find('.item').eq(gi).addClass('active');
            else colC.find('.item').eq(ci).addClass('active');
        };

        this.render = function () { return root; };
        this.destroy = function () {
            Lampa.Controller.remove('iptv_stable');
            root.remove();
        };
    }

    function init() {
        Lampa.Component.add('iptv_stable', IPTVComponent);
        $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>')
            .on('hover:enter', function () {
                Lampa.Activity.push({ title: 'IPTV', component: 'iptv_stable' });
            })
            .appendTo('.menu .menu__list');
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') init();
    });
})();
