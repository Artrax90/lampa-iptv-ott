// ==Lampa==
// name: IPTV Stable + TV Control Fix
// version: 4.1.1
// author: Artrax90 & Gemini
// ==/Lampa==

(function () {
    'use strict';

    var DEFAULT_PLAYLIST = {
        name: 'LoganetTV MEGA',
        url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'
    };

    function IPTVComponent() {
        var _this = this; // Для доступа из функций
        var root = $('<div class="iptv-root"></div>');
        var colG = $('<div class="iptv-col g"></div>');
        var colC = $('<div class="iptv-col c"></div>');
        var colE = $('<div class="iptv-col e"></div>');
        root.append(colG, colC, colE);

        var playlists = Lampa.Storage.get('iptv_pl', [DEFAULT_PLAYLIST]);
        var active = Lampa.Storage.get('iptv_pl_a', 0);
        var groups = {};

        /* ===== STYLE (без изменений) ===== */
        if (!$('#iptv-style-default').length) {
            $('head').append('<style id="iptv-style-default">.iptv-root{display:flex;height:100vh;background:#0b0d10;color:#fff}.iptv-col{overflow:auto}.g{width:260px;padding:14px;background:#0e1116}.c{flex:1;padding:18px}.e{width:420px;padding:18px;background:#0e1116}.item{padding:14px;border-radius:12px;margin-bottom:8px;background:#15181d}.item.focus{background:#2962ff}.chan{display:flex;align-items:center}.logo{width:64px;height:36px;background:#000;border-radius:8px;margin-right:14px;display:flex;align-items:center;justify-content:center}.logo img{max-width:100%;max-height:100%;object-fit:contain}.name{font-size:1.05em}.sub{font-size:.85em;color:#9aa0a6;margin-top:4px}.et{font-size:1.2em;margin-bottom:10px}.er{margin-bottom:8px;color:#cfcfcf}</style>');
        }

        /* ===== TV CONTROLLERS (ГЛАВНЫЙ ФИКС) ===== */
        this.registerControllers = function() {
            // Контроллер для групп (левая колонка)
            Lampa.Controller.add('iptv_groups', {
                toggle: function() {
                    Lampa.Controller.collectionSet(colG);
                    Lampa.Controller.follow('right', function() {
                        Lampa.Controller.enable('iptv_channels');
                    });
                },
                left: function() {
                    Lampa.Controller.toggle('menu'); // Уход в главное меню Лампы
                }
            });

            // Контроллер для каналов (центральная колонка)
            Lampa.Controller.add('iptv_channels', {
                toggle: function() {
                    Lampa.Controller.collectionSet(colC);
                    Lampa.Controller.follow('left', function() {
                        Lampa.Controller.enable('iptv_groups');
                    });
                }
            });
        };

        this.create = function () {
            this.registerControllers();
            renderGroups();
            loadPlaylist();
        };

        this.render = function () { return root; };

        this.start = function () {
            Lampa.Controller.enable('iptv_groups');
        };

        /* ===== CORE LOGIC ===== */
        function loadPlaylist() {
            $.ajax({
                url: playlists[active].url,
                success: parseM3U,
                error: function () { Lampa.Noty.show('Ошибка загрузки'); }
            });
        }

        function parseM3U(str) {
            groups = {};
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
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    cur = null;
                }
            });
            renderGroups();
        }

        function renderGroups() {
            colG.empty();
            Object.keys(groups).forEach(function (g) {
                var item = $('<div class="selector item">' + g + '</div>');
                item.on('hover:enter', function () {
                    renderChannels(groups[g]);
                }).appendTo(colG);
            });
        }

        function renderChannels(list) {
            colC.empty();
            list.forEach(function (c) {
                var row = $(`
                    <div class="selector item chan">
                        <div class="logo"><img src="${c.logo || 'https://bylampa.github.io/img/iptv.png'}"></div>
                        <div><div class="name">${c.name}</div><div class="sub">OK ▶</div></div>
                    </div>
                `);
                
                row.on('hover:focus', function () { updateInfo(c); });
                row.on('hover:enter', function () {
                    Lampa.Player.play({ url: c.url, title: c.name, type: 'tv', epg: true });
                });
                colC.append(row);
            });
            // После рендера переключаем фокус на колонку каналов
            Lampa.Controller.enable('iptv_channels');
        }

        function updateInfo(c) {
            colE.empty();
            $('<div class="et">' + c.name + '</div><div class="er">Программа подгрузится в плеере</div>').appendTo(colE);
        }

        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () {
            root.remove();
        };
    }

    function init() {
        Lampa.Component.add('iptv', IPTVComponent);
        var item = $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>');
        item.on('hover:enter', function () {
            Lampa.Activity.push({ title: 'IPTV', component: 'iptv' });
        });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();
