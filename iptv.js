// ==Lampa==
// name: IPTV Lite Stable
// version: 1.5.0
// description: Stable browser version (rollback)
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    var DEFAULT_PLAYLIST = 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u';

    function IPTVComponent() {
        var _this = this;
        var root = $('<div class="iptv-root"></div>');
        var list = $('<div class="iptv-list"></div>');
        root.append(list);

        var groups = {};
        var current_group = null;

        /* ================= STYLE ================= */

        if (!$('#iptv-style-stable').length) {
            $('head').append(`
                <style id="iptv-style-stable">
                .iptv-root{
                    padding:20px;
                    background:#0e1116;
                    min-height:100vh;
                }
                .iptv-item{
                    display:flex;
                    align-items:center;
                    padding:14px 16px;
                    margin-bottom:8px;
                    background:#1a1d23;
                    border-radius:10px;
                    cursor:pointer;
                }
                .iptv-item.focus{
                    background:#2f6bff;
                }
                .iptv-item .name{
                    color:#fff;
                    font-size:1.15em;
                }
                .iptv-btn{
                    background:#232733;
                    font-weight:600;
                }
                </style>
            `);
        }

        /* ================= CORE ================= */

        this.create = function () {
            var url = Lampa.Storage.get('iptv_playlist_url', DEFAULT_PLAYLIST);
            load(url);
        };

        this.render = function () {
            return root;
        };

        this.start = function () {
            focus();
        };

        this.destroy = function () {
            root.remove();
        };

        /* ================= LOAD & PARSE ================= */

        function load(url) {
            $.ajax({
                url: url,
                success: function (text) {
                    parse(text);
                    renderGroups();
                },
                error: function () {
                    Lampa.Noty.show('Не удалось загрузить плейлист');
                }
            });
        }

        function parse(text) {
            groups = { 'ВСЕ КАНАЛЫ': [] };
            var lines = text.split('\n');
            var cur = null;

            lines.forEach(function (l) {
                l = l.trim();

                if (l.indexOf('#EXTINF') === 0) {
                    cur = {
                        name: l.split(',').pop(),
                        group: (l.match(/group-title="([^"]+)"/i) || [])[1] || 'ОБЩИЕ'
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
        }

        /* ================= RENDER ================= */

        function renderGroups() {
            list.empty();

            addBtn('➕ Добавить плейлист', addPlaylist);

            Object.keys(groups).sort().forEach(function (g) {
                addBtn('📁 ' + g, function () {
                    current_group = g;
                    renderList(groups[g]);
                });
            });

            focus();
        }

        function renderList(arr) {
            list.empty();

            addBtn('⬅ Назад', renderGroups);

            arr.forEach(function (c) {
                var row = $(`
                    <div class="iptv-item selector">
                        <div class="name">${c.name}</div>
                    </div>
                `);

                row.on('hover:enter', function () {
                    Lampa.Player.play({
                        url: c.url,
                        title: c.name,
                        type: 'tv'
                    });
                });

                list.append(row);
            });

            focus();
        }

        function addBtn(name, action) {
            var btn = $(`
                <div class="iptv-item iptv-btn selector">
                    <div class="name">${name}</div>
                </div>
            `);

            btn.on('hover:enter', action);
            list.append(btn);
        }

        /* ================= UI HELPERS ================= */

        function addPlaylist() {
            Lampa.Input.edit({
                title: 'Ссылка на M3U плейлист',
                value: '',
                free: true
            }, function (val) {
                if (!val) return;
                Lampa.Storage.set('iptv_playlist_url', val);
                load(val);
            });
        }

        function focus() {
            Lampa.Controller.enable('content');
            var first = list.find('.selector').first();
            if (first.length) Lampa.Controller.focus(first[0]);
        }
    }

    /* ================= INIT ================= */

    function init() {
        Lampa.Component.add('iptv_lite_stable', IPTVComponent);

        $('.menu .menu__list').append(`
            <li class="menu__item selector" data-action="iptv_lite_stable">
                <div class="menu__text">IPTV</div>
            </li>
        `);

        $('.menu [data-action="iptv_lite_stable"]').on('hover:enter', function () {
            Lampa.Activity.push({
                title: 'IPTV',
                component: 'iptv_lite_stable',
                page: 1
            });
        });
    }

    if (window.app_ready) init();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
