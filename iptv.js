// ==Lampa==
// name: IPTV Stable (Default Playlist + Tizen FIX)
// version: 4.1.2
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

        if (!$('#iptv-style-tizen-fix').length) {
            $('head').append(`
            <style id="iptv-style-tizen-fix">
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

        function focus(box){
            var f = box.find('.selector').first();
            if (!f.length) return;

            setTimeout(function () {
                Lampa.Controller.enable('content');
                Lampa.Controller.focus(f[0]);
            }, 20);
        }

        this.create = function () {
            renderGroups();
            loadPlaylist();
        };

        this.render = function () {
            return root;
        };

        this.start = function () {
            focus(colG);
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

            $('<div class="selector item">➕ Добавить плейлист</div>')
                .on('hover:enter', addPlaylist)
                .appendTo(colG);

            Object.keys(groups).forEach(function (g) {
                $('<div class="selector item">' + g + '</div>')
                    .on('hover:enter', function () {
                        renderChannels(groups[g]);
                    })
                    .appendTo(colG);
            });

            focus(colG);
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
                    <div class="selector item chan">
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

                row.on('hover:focus', function () {
                    updateInfo(c);
                });

                row.on('hover:enter', function () {
                    Lampa.Player.play({
                        url: c.url,
                        title: c.name,
                        type: 'tv',
                        epg: true,
                        epg_id: c.id || c.name
                    });
                });

                colC.append(row);
            });

            focus(colC);
        }

        function updateInfo(c) {
            colE.empty();
            $('<div class="et">' + c.name + '</div>').appendTo(colE);

            var text = 'Программа появится после запуска канала';
            try {
                if (Lampa.TV && Lampa.TV.getEPG) {
                    var e = Lampa.TV.getEPG(c.id || c.name);
                    if (e && e.current) {
                        text = 'Сейчас: ' + e.current.title;
                    }
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
