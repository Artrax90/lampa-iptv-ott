// ==Lampa==
// name: IPTV ControllerCollection TV
// version: 7.0.0
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    var DEFAULT_PLAYLIST = {
        name: 'LoganetTV MEGA',
        url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'
    };

    function IPTVComponent() {
        var html = $('<div class="iptv-root"></div>');
        var colG = $('<div class="iptv-col g"></div>');
        var colC = $('<div class="iptv-col c"></div>');
        var colE = $('<div class="iptv-col e"></div>');
        html.append(colG, colC, colE);

        var playlists = Lampa.Storage.get('iptv_pl', []);
        var active = Lampa.Storage.get('iptv_pl_a', 0);
        var favorites = Lampa.Storage.get('iptv_fav', []);
        var groups = {};
        var channels = [];
        var current = null;
        var controller;

        if (!playlists.length) {
            playlists = [DEFAULT_PLAYLIST];
            Lampa.Storage.set('iptv_pl', playlists);
            Lampa.Storage.set('iptv_pl_a', 0);
        }

        if (!$('#iptv-cc-style').length) {
            $('head').append(`
            <style id="iptv-cc-style">
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
            loadPlaylist();
        };

        this.render = function () {
            return html;
        };

        this.start = function () {
            enableController();
        };

        this.destroy = function () {
            if (controller) controller.destroy();
        };

        function enableController() {
            if (controller) controller.enable();
        }

        function loadPlaylist() {
            $.ajax({
                url: playlists[active].url,
                success: parseM3U,
                error: function () {
                    Lampa.Noty.show('Ошибка загрузки плейлиста');
                }
            });
        }

        function parseM3U(text) {
            groups = {};
            channels = [];
            var cur = null;

            text.split('\n').forEach(function (l) {
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
                    channels.push(cur);
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    cur = null;
                }
            });

            renderGroups();
        }

        function renderGroups() {
            colG.empty();
            colC.empty();
            colE.empty();

            Object.keys(groups).forEach(function (g) {
                $('<div class="item selector" data-group="' + g + '">' + g + '</div>').appendTo(colG);
            });

            initController();
        }

        function renderChannels(list) {
            colC.empty();
            colE.empty();
            current = null;

            list.forEach(function (c, i) {
                var logo = c.logo || (c.id ? 'https://iptvx.one/logo/' + c.id + '.png' : 'https://bylampa.github.io/img/iptv.png');
                var row = $(`
                    <div class="item selector chan" data-index="${i}">
                        <div class="logo"><img src="${logo}"></div>
                        <div>
                            <div class="name">${c.name}</div>
                            <div class="sub">OK ▶</div>
                        </div>
                    </div>
                `);
                row.find('img').on('error', function () {
                    this.src = 'https://bylampa.github.io/img/iptv.png';
                });
                colC.append(row);
            });
        }

        function updateEPG(c) {
            colE.empty();
            $('<div class="et">' + c.name + '</div>').appendTo(colE);

            var txt = 'Программа появится после запуска канала';
            try {
                if (Lampa.TV && Lampa.TV.getEPG) {
                    var e = Lampa.TV.getEPG(c.id || c.name);
                    if (e && e.current) txt = 'Сейчас: ' + e.current.title;
                }
            } catch (e) {}

            $('<div class="er">' + txt + '</div>').appendTo(colE);
        }

        function initController() {
            if (controller) controller.destroy();

            controller = new Lampa.ControllerCollection({
                name: 'iptv',
                position: 'content',
                visible: true
            });

            controller.add({
                selector: colG.find('.selector'),
                enter: function (el) {
                    var g = el.data('group');
                    renderChannels(groups[g]);
                    controller.update();
                }
            });

            controller.add({
                selector: colC,
                children: '.selector',
                focus: function (el) {
                    var idx = parseInt(el.data('index'));
                    current = groups[Object.keys(groups)[0]][idx] || channels[idx];
                    if (current) updateEPG(current);
                },
                enter: function () {
                    if (!current) return;
                    Lampa.Player.play({
                        url: current.url,
                        title: current.name,
                        type: 'tv',
                        epg: true,
                        epg_id: current.id || current.name
                    });
                },
                back: function () {
                    controller.focus(colG.find('.selector').eq(0));
                }
            });

            controller.enable();
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
