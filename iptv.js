// ==Lampa==
// name: IPTV TiviMate Visual
// version: 1.5.0
// description: IPTV plugin with TiviMate-like UI (stable visual update)
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;

        var root = $('<div class="tm-root"></div>');
        var groupsBox = $('<div class="tm-groups"></div>');
        var channelsBox = $('<div class="tm-channels"></div>');

        root.append(groupsBox, channelsBox);

        var groups = {};

        /* ================= STYLES ================= */

        if (!$('#tm-style').length) {
            $('head').append(`
            <style id="tm-style">
            .tm-root{
                display:flex;
                height:100vh;
                background:radial-gradient(circle at top,#15171c 0%,#050607 60%);
                color:#fff;
                font-family:Roboto,Arial;
            }
            .tm-groups{
                width:260px;
                padding:16px;
                background:#0b0d10;
                overflow:auto;
            }
            .tm-group{
                padding:14px 16px;
                border-radius:10px;
                margin-bottom:8px;
                background:#15181d;
                font-size:1.05em;
            }
            .tm-group.focus{
                background:linear-gradient(135deg,#2962ff,#2979ff);
                transform:scale(1.03);
            }
            .tm-channels{
                flex:1;
                padding:20px;
                overflow:auto;
            }
            .tm-channel{
                display:flex;
                align-items:center;
                padding:14px;
                border-radius:12px;
                margin-bottom:10px;
                background:#12151a;
            }
            .tm-channel.focus{
                background:#1e232b;
                transform:scale(1.01);
            }
            .tm-channel img{
                width:64px;
                height:36px;
                object-fit:contain;
                background:#000;
                border-radius:6px;
                margin-right:16px;
            }
            .tm-name{
                font-size:1.1em;
                font-weight:500;
                flex:1;
            }
            .tm-epg{
                font-size:.9em;
                opacity:.6;
                max-width:40%;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
            }
            </style>
            `);
        }

        /* ================= LOGIC (НЕ МЕНЯЛИ) ================= */

        this.create = function () {
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderSettings();
            else this.load(url);
        };

        this.load = function (url) {
            $.ajax({
                url: url,
                success: function (str) {
                    _this.parse(str);
                    _this.renderGroups();
                },
                error: function () {
                    $.ajax({
                        url: 'https://corsproxy.io/?' + encodeURIComponent(url),
                        success: function (s) { _this.parse(s); _this.renderGroups(); },
                        error: function () { Lampa.Noty.show('Не удалось загрузить плейлист'); }
                    });
                }
            });
        };

        this.parse = function (str) {
            groups = { 'ВСЕ КАНАЛЫ': [] };
            var lines = str.split('\n');
            var cur = null;

            lines.forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: l.match(/,(.*)$/)?.[1] || 'Без названия',
                        id: l.match(/tvg-id="([^"]+)"/i)?.[1] || '',
                        logo: l.match(/tvg-logo="([^"]+)"/i)?.[1] || '',
                        group: l.match(/group-title="([^"]+)"/i)?.[1] || 'ОБЩИЕ'
                    };
                }
                else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    groups['ВСЕ КАНАЛЫ'].push(cur);
                    cur = null;
                }
            });
        };

        this.renderGroups = function () {
            groupsBox.empty();

            Object.keys(groups).sort().forEach(function (g) {
                var btn = $('<div class="selector tm-group">' + g + '</div>');
                btn.on('hover:enter', function () {
                    _this.renderList(groups[g]);
                });
                groupsBox.append(btn);
            });

            this.focus(groupsBox);
        };

        this.renderList = function (list) {
            channelsBox.empty();

            list.forEach(function (chan) {
                var epg = 'Программа загружается...';
                try {
                    if (Lampa.TV) {
                        var data = Lampa.TV.getEPG(chan.id || chan.name);
                        if (data && data.current) epg = data.current.title;
                    }
                } catch (e) {}

                var row = $(`
                    <div class="selector tm-channel">
                        <img src="${chan.logo}" onerror="this.style.display='none'">
                        <div class="tm-name">${chan.name}</div>
                        <div class="tm-epg">${epg}</div>
                    </div>
                `);

                row.on('hover:enter', function () {
                    Lampa.Player.play({ url: chan.url, title: chan.name });
                });

                channelsBox.append(row);
            });

            this.focus(channelsBox);
        };

        this.renderSettings = function () {
            Lampa.Input.edit({
                title: 'Введите ссылку на M3U плейлист',
                value: Lampa.Storage.get('iptv_m3u_link', ''),
                free: true
            }, function (v) {
                if (v) {
                    Lampa.Storage.set('iptv_m3u_link', v);
                    _this.load(v);
                }
            });
        };

        this.focus = function (box) {
            Lampa.Controller.enable('content');
            var first = box.find('.selector').first();
            if (first.length) Lampa.Controller.focus(first[0]);
        };

        this.render = function () { return root; };
        this.start = function () { this.focus(groupsBox); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { root.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);

        var btn = $(`
            <li class="menu__item selector" data-action="iptv_lite">
                <div class="menu__ico">📺</div>
                <div class="menu__text">IPTV</div>
            </li>
        `);

        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                title: 'IPTV',
                component: 'iptv_lite'
            });
        });

        $('.menu .menu__list').append(btn);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') init();
    });

})();
