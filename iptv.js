// ==Lampa==
// name: IPTV Navigation TV
// version: 6.0.0
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    var DEFAULT_PLAYLIST = {
        name: 'LoganetTV MEGA',
        url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'
    };

    function IPTVComponent() {
        var root = $('<div class="iptv-root"></div>');
        var colG = $('<div class="iptv-col g"></div>');
        var colC = $('<div class="iptv-col c"></div>');
        var colE = $('<div class="iptv-col e"></div>');
        root.append(colG, colC, colE);

        var playlists = Lampa.Storage.get('iptv_pl', null);
        var active = Lampa.Storage.get('iptv_pl_a', 0);
        var fav = Lampa.Storage.get('iptv_fav', []);

        if (!Array.isArray(playlists) || !playlists.length) {
            playlists = [DEFAULT_PLAYLIST];
            active = 0;
            Lampa.Storage.set('iptv_pl', playlists);
            Lampa.Storage.set('iptv_pl_a', active);
        }

        var groups = {};
        var all = [];
        var navGroups, navChannels;
        var currentChannel = null;

        if (!$('#iptv-style-navigation').length) {
            $('head').append(`
            <style id="iptv-style-navigation">
            .iptv-root{display:flex;height:100vh;background:#0b0d10;color:#fff}
            .iptv-col{overflow:auto}
            .g{width:260px;padding:14px;background:#0e1116}
            .c{flex:1;padding:18px}
            .e{width:420px;padding:18px;background:#0e1116}
            .item{padding:14px;border-radius:12px;margin-bottom:8px;background:#15181d}
            .item.focus{background:#2962ff}
            .chan{display:flex;align-items:center}
            .logo{width:64px;height:36px;background:#000;border-radius:8px;margin-right:14px;display:flex;align-items:center;justify-content:center}
            .logo img{max-width:100%;max-height:100%;object-fit:contain}
            .name{font-size:1.05em}
            .sub{font-size:.85em;color:#9aa0a6;margin-top:4px}
            .et{font-size:1.2em;margin-bottom:10px}
            .er{margin-bottom:8px;color:#cfcfcf}
            </style>
            `);
        }

        this.create = function () {
            renderGroups();
            loadPlaylist();
        };

        this.render = function () {
            return root;
        };

        this.start = function () {
            if (navGroups) navGroups.enable();
        };

        this.destroy = function () {
            if (navGroups) navGroups.destroy();
            if (navChannels) navChannels.destroy();
        };

        function addPlaylist() {
            Lampa.Input.edit(
                { title: 'Добавить плейлист (URL)', value: '', free: true },
                function (u) {
                    if (typeof u !== 'string') return;
                    u = u.trim();
                    if (!u) return;
                    playlists.push({ name: 'Плейлист ' + (playlists.length + 1), url: u });
                    Lampa.Storage.set('iptv_pl', playlists);
                    active = playlists.length - 1;
                    Lampa.Storage.set('iptv_pl_a', active);
                    loadPlaylist();
                }
            );
        }

        function loadPlaylist() {
            $.ajax({
                url: playlists[active].url,
                success: parseM3U,
                error: function () {
                    Lampa.Noty.show('Не удалось загрузить плейлист');
                }
            });
        }

        function parseM3U(str) {
            groups = { '⭐ Избранное': [] };
            all = [];
            var cur = null;

            str.split('\n').forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: (l.match(/,(.*)$/) || [,''])[1],
                        id: (l.match(/tvg-id="([^"]+)"/i) || [,''])[1],
                        logo: (l.match(/tvg-logo="([^"]+)"/i) || [,''])[1],
                        group: (l.match(/group-title="([^"]+)"/i) || [,'ОБЩИЕ'])[1]
                    };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    all.push(cur);
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    cur = null;
                }
            });

            groups['⭐ Избранное'] = all.filter(c => fav.includes(c.name));
            renderGroups();
        }

        function renderGroups() {
            colG.empty();

            $('<div class="item selector">➕ Добавить плейлист</div>').appendTo(colG);

            Object.keys(groups).forEach(function (g) {
                $('<div class="item selector">' + g + '</div>').appendTo(colG);
            });

            if (navGroups) navGroups.destroy();

            navGroups = new Lampa.Navigation({
                selector: colG.find('.selector'),
                onEnter: function (el) {
                    var text = $(el).text();
                    if (text.indexOf('Добавить') === 0) addPlaylist();
                    else renderChannels(groups[text]);
                }
            });

            navGroups.enable();
        }

        function channelLogo(c){
            if (c.logo) return c.logo;
            if (c.id) return 'https://iptvx.one/logo/' + c.id + '.png';
            return 'https://bylampa.github.io/img/iptv.png';
        }

        function renderChannels(list) {
            colC.empty();
            colE.empty();

            list.forEach(function (c) {
                var row = $(`
                    <div class="item selector chan">
                        <div class="logo"><img></div>
                        <div>
                            <div class="name">${c.name}</div>
                            <div class="sub">OK ▶</div>
                        </div>
                    </div>
                `);

                row.find('img')
                    .attr('src', channelLogo(c))
                    .on('error', function () {
                        this.src = 'https://bylampa.github.io/img/iptv.png';
                    });

                colC.append(row);
            });

            if (navChannels) navChannels.destroy();

            navChannels = new Lampa.Navigation({
                selector: colC.find('.selector'),
                onFocus: function (el) {
                    var idx = $(el).index();
                    currentChannel = list[idx];
                    updateInfo(currentChannel);
                },
                onEnter: function () {
                    if (!currentChannel) return;
                    Lampa.Player.play({
                        url: currentChannel.url,
                        title: currentChannel.name,
                        type: 'tv',
                        epg: true,
                        epg_id: currentChannel.id || currentChannel.name
                    });
                },
                onBack: function () {
                    navChannels.disable();
                    navGroups.enable();
                }
            });

            navChannels.enable();
        }

        function updateInfo(c) {
            colE.empty();
            $('<div class="et">' + c.name + '</div>').appendTo(colE);

            var text = 'Программа появится после запуска канала';
            try {
                if (Lampa.TV && Lampa.TV.getEPG) {
                    var e = Lampa.TV.getEPG(c.id || c.name);
                    if (e && e.current) text = 'Сейчас: ' + e.current.title;
                }
            } catch (e) {}

            $('<div class="er">' + text + '</div>').appendTo(colE);
        }
    }

    function init() {
        Lampa.Component.add('iptv', IPTVComponent);
        $('.menu .menu__list').append(
            $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>')
                .on('hover:enter', function () {
                    Lampa.Activity.push({ title: 'IPTV', component: 'iptv' });
                })
        );
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') init();
    });
})();
