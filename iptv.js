// ==Lampa==
// name: IPTV TiviMate Visual Final
// version: 2.0.0
// description: Stable IPTV plugin (multi playlists, favorites, search)
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
        var pressTimer = null;

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
            .tm-channel img{width:64px;height:36px;background:#000;border-radius:6px;margin-right:16px}
            .tm-name{flex:1;font-size:1.1em}
            .tm-star{color:#ffcc00;margin-right:10px}
            </style>
            `);
        }

        /* ================= CORE ================= */

        this.create = function () {
            if (!playlists.length) {
                requestAddPlaylist();
            } else {
                loadActive();
            }
        };

        function requestAddPlaylist() {
            Lampa.Input.edit({
                title: 'Добавить плейлист (URL)',
                value: '',
                free: true
            }, function (url) {
                if (!url) return;

                playlists.push({
                    name: 'Плейлист ' + (playlists.length + 1),
                    url: url
                });

                Lampa.Storage.set('iptv_playlists', playlists);
                activeIndex = playlists.length - 1;
                Lampa.Storage.set('iptv_active_playlist', activeIndex);

                restart();
            });
        }

        function restart() {
            Lampa.Activity.close();
            setTimeout(function () {
                Lampa.Activity.push({
                    title: 'IPTV',
                    component: 'iptv_lite'
                });
            }, 50);
        }

        function showPlaylistMenu() {
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
                    setTimeout(requestAddPlaylist, 50);
                }
            });

            Lampa.Select.show({
                title: 'Плейлисты',
                items: items
            });
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
                        },
                        error: function () {
                            Lampa.Noty.show('Ошибка загрузки плейлиста');
                        }
                    });
                }
            });
        }

        function parse(str) {
            groups = { '⭐ ИЗБРАННОЕ': [] };
            allChannels = [];

            var cur = null;

            str.split('\n').forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: l.match(/,(.*)$/)?.[1] || '',
                        logo: l.match(/tvg-logo="([^"]+)"/i)?.[1] || '',
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
            groups['⭐ ИЗБРАННОЕ'] = allChannels.filter(function (c) {
                return favorites.includes(c.name);
            });
        }

        function renderGroups() {
            groupsBox.empty();

            $('<div class="selector tm-group">📂 ПЛЕЙЛИСТЫ</div>')
                .on('hover:enter', showPlaylistMenu)
                .appendTo(groupsBox);

            $('<div class="selector tm-group">🔍 ПОИСК</div>')
                .on('hover:enter', startSearch)
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
                var isFav = favorites.includes(chan.name);

                var row = $(`
                    <div class="selector tm-channel">
                        <img src="${chan.logo}" onerror="this.style.display='none'">
                        ${isFav ? '<div class="tm-star">★</div>' : '<div class="tm-star"></div>'}
                        <div class="tm-name">${chan.name}</div>
                    </div>
                `);

                row.on('hover:enter', function () {
                    pressTimer = setTimeout(function () {
                        toggleFavorite(chan);
                        rebuildFavorites();
                        renderGroups();
                        renderList(currentList);
                    }, 700);
                });

                row.on('hover:leave', function () {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                        Lampa.Player.play({ url: chan.url, title: chan.name });
                    }
                });

                channelsBox.append(row);
            });

            focus(channelsBox);
        }

        function toggleFavorite(chan) {
            if (favorites.includes(chan.name)) {
                favorites = favorites.filter(f => f !== chan.name);
            } else {
                favorites.push(chan.name);
            }
            Lampa.Storage.set('iptv_fav', favorites);
        }

        function startSearch() {
            Lampa.Input.edit({
                title: 'Поиск канала',
                value: '',
                free: true
            }, function (v) {
                if (!v) return;
                var q = v.toLowerCase();
                var result = allChannels.filter(function (c) {
                    return c.name.toLowerCase().includes(q);
                });
                renderList(result);
            });
        }

        function focus(box) {
            Lampa.Controller.enable('content');
            var first = box.find('.selector').first();
            if (first.length) Lampa.Controller.focus(first[0]);
        }

        this.render = function () { return root; };
        this.start = function () { focus(groupsBox); };
        this.destroy = function () { root.remove(); };
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
