// ==Lampa==
// name: IPTV TiviMate Final Fixed
// version: 3.1.0
// description: Stable IPTV plugin with EPG on long press and favorites inside EPG
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent() {
        var _this = this;

        /* ================= STATE ================= */

        var playlists = Lampa.Storage.get('iptv_playlists', []);
        var activeIndex = Lampa.Storage.get('iptv_active_playlist', 0);
        var favorites = Lampa.Storage.get('iptv_fav', []);

        var groups = {};
        var allChannels = [];
        var currentList = [];

        var EPG_URL = 'https://iptvx.one/EPG';

        /* ================= UI ================= */

        var root = $('<div class="tm-root"></div>');
        var groupsBox = $('<div class="tm-groups"></div>');
        var channelsBox = $('<div class="tm-channels"></div>');

        root.append(groupsBox, channelsBox);

        /* ================= STYLES ================= */

        if (!$('#tm-style').length) {
            $('head').append(`
            <style id="tm-style">
            .tm-root{display:flex;height:100vh;background:#050607;color:#fff;font-family:Roboto,Arial}
            .tm-groups{width:260px;padding:16px;background:#0b0d10;overflow:auto}
            .tm-group{padding:14px;border-radius:10px;margin-bottom:8px;background:#15181d}
            .tm-group.focus{background:#2962ff}
            .tm-channels{flex:1;padding:20px;overflow:auto}

            .tm-channel{display:flex;align-items:center;padding:14px;border-radius:12px;margin-bottom:10px;background:#12151a}
            .tm-channel.focus{background:#1e232b}

            .tm-logo{width:72px;height:40px;background:#000;border-radius:8px;margin-right:16px;display:flex;align-items:center;justify-content:center}
            .tm-logo img{max-width:90%;max-height:90%;object-fit:contain}

            .tm-info{flex:1}
            .tm-name{font-size:1.1em}
            .tm-epg{font-size:.85em;color:#9aa0a6;margin-top:4px}
            </style>
            `);
        }

        /* ================= HELPERS ================= */

        function normalize(name) {
            return name.toLowerCase()
                .replace(/\(.*?\)/g, '')
                .replace(/hd|fhd|uhd|sd/gi, '')
                .replace(/[^\w]+/g, '')
                .trim();
        }

        function logoByName(name) {
            var n = normalize(name);
            return [
                'https://iptvx.one/logo/' + n + '.png',
                'https://epg.one/logo/' + n + '.png',
                'https://bylampa.github.io/img/iptv.png'
            ];
        }

        function epgId(chan) {
            return chan.tvg_id || normalize(chan.name);
        }

        /* ================= CORE ================= */

        this.create = function () {
            if (!playlists.length) addPlaylist();
            else loadActive();
        };

        this.render = function () {
            return root;
        };

        this.start = function () {
            focus(groupsBox);
        };

        this.destroy = function () {
            root.remove();
        };

        function restart() {
            Lampa.Activity.close();
            setTimeout(function () {
                Lampa.Activity.push({ title: 'IPTV', component: 'iptv_lite' });
            }, 50);
        }

        function addPlaylist() {
            Lampa.Input.edit({
                title: 'Добавить плейлист (URL)',
                value: '',
                free: true
            }, function (url) {
                if (!url) return;
                playlists.push({ name: 'Плейлист ' + (playlists.length + 1), url: url });
                Lampa.Storage.set('iptv_playlists', playlists);
                activeIndex = playlists.length - 1;
                Lampa.Storage.set('iptv_active_playlist', activeIndex);
                restart();
            });
        }

        function playlistMenu() {
            var items = playlists.map(function (p, i) {
                return {
                    title: (i === activeIndex ? '✔ ' : '') + p.name,
                    onSelect: function () {
                        activeIndex = i;
                        Lampa.Storage.set('iptv_active_playlist', i);
                        loadActive();
                    }
                };
            });

            items.push({
                title: '➕ Добавить плейлист',
                onSelect: function () {
                    setTimeout(addPlaylist, 50);
                }
            });

            Lampa.Select.show({ title: 'Плейлисты', items: items });
        }

        function loadActive() {
            var pl = playlists[activeIndex];
            $.ajax({
                url: pl.url,
                success: function (str) {
                    parse(str);
                    rebuildFavorites();
                    renderGroups();
                },
                error: function () {
                    $.ajax({
                        url: 'https://corsproxy.io/?' + encodeURIComponent(pl.url),
                        success: function (s) {
                            parse(s);
                            rebuildFavorites();
                            renderGroups();
                        }
                    });
                }
            });
        }

        function parse(str) {
            groups = { '⭐ Избранное': [] };
            allChannels = [];
            var cur = null;

            str.split('\n').forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: l.match(/,(.*)$/)?.[1] || '',
                        tvg_id: l.match(/tvg-id="([^"]+)"/i)?.[1] || '',
                        group: l.match(/group-title="([^"]+)"/i)?.[1] || 'ОБЩИЕ'
                    };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    allChannels.push(cur);
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    cur = null;
                }
            });
        }

        function rebuildFavorites() {
            groups['⭐ Избранное'] = allChannels.filter(c => favorites.includes(c.name));
        }

        function renderGroups() {
            groupsBox.empty();

            $('<div class="selector tm-group">📂 Плейлисты</div>')
                .on('hover:enter', playlistMenu)
                .appendTo(groupsBox);

            $('<div class="selector tm-group">🔍 Поиск</div>')
                .on('hover:enter', search)
                .appendTo(groupsBox);

            Object.keys(groups).forEach(function (g) {
                $('<div class="selector tm-group">' + g + '</div>')
                    .on('hover:enter', function () {
                        currentList = groups[g];
                        renderList(currentList);
                    })
                    .appendTo(groupsBox);
            });

            focus(groupsBox);
        }

        function renderList(list) {
            channelsBox.empty();
            currentList = list;

            list.forEach(function (chan) {
                var logos = logoByName(chan.name);

                var row = $(`
                    <div class="selector tm-channel">
                        <div class="tm-logo">
                            <img src="${logos[0]}" onerror="this.src='${logos[1]}'">
                        </div>
                        <div class="tm-info">
                            <div class="tm-name">${chan.name}</div>
                            <div class="tm-epg">OK — ▶ | LONG OK — 📘</div>
                        </div>
                    </div>
                `);

                // OK — PLAY
                row.on('hover:enter', function () {
                    Lampa.Player.play({
                        url: chan.url,
                        title: chan.name,
                        type: 'tv',
                        epg: EPG_URL,
                        epg_id: epgId(chan)
                    });
                });

                // LONG OK — EPG
                row.on('long:enter', function () {
                    openEPG(chan);
                });

                channelsBox.append(row);
            });

            focus(channelsBox);
        }

        function openEPG(chan) {
            Lampa.Select.show({
                title: chan.name,
                items: [
                    {
                        title: favorites.includes(chan.name) ? '⭐ Убрать из избранного' : '⭐ В избранное',
                        onSelect: function () {
                            if (favorites.includes(chan.name))
                                favorites = favorites.filter(f => f !== chan.name);
                            else
                                favorites.push(chan.name);
                            Lampa.Storage.set('iptv_fav', favorites);
                            rebuildFavorites();
                            renderGroups();
                        }
                    },
                    {
                        title: '▶ Смотреть',
                        onSelect: function () {
                            Lampa.Player.play({
                                url: chan.url,
                                title: chan.name,
                                type: 'tv',
                                epg: EPG_URL,
                                epg_id: epgId(chan)
                            });
                        }
                    }
                ]
            });
        }

        function search() {
            Lampa.Input.edit({
                title: 'Поиск канала',
                value: '',
                free: true
            }, function (v) {
                if (!v) return;
                renderList(allChannels.filter(c => c.name.toLowerCase().includes(v.toLowerCase())));
            });
        }

        function focus(box) {
            Lampa.Controller.enable('content');
            var first = box.find('.selector').first();
            if (first.length) Lampa.Controller.focus(first[0]);
        }
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);

        var btn = $('<li class="menu__item selector"><div class="menu__ico">📺</div><div class="menu__text">IPTV</div></li>');
        btn.on('hover:enter', function () {
            Lampa.Activity.push({ title: 'IPTV', component: 'iptv_lite' });
        });
        $('.menu .menu__list').append(btn);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') init();
    });

})();
