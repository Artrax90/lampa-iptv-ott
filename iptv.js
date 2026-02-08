// ==Lampa==
// name: IPTV Stable Hybrid
// version: 4.2.0
// author: Artrax90 & Gemini
// ==/Lampa==

(function () {
    'use strict';

    var DEFAULT_PLAYLIST = {
        name: 'LoganetTV MEGA',
        url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'
    };

    function IPTVComponent() {
        var _this = this;
        var root = $('<div class="iptv-root"></div>');
        var colG = $('<div class="iptv-col g"></div>');
        var colC = $('<div class="iptv-col c"></div>');
        var colE = $('<div class="iptv-col e"></div>');
        root.append(colG, colC, colE);

        var playlists = Lampa.Storage.get('iptv_pl', [DEFAULT_PLAYLIST]);
        var active = Lampa.Storage.get('iptv_pl_a', 0);
        var fav = Lampa.Storage.get('iptv_fav', []);
        var groups = {};
        var all = [];

        /* ===== STYLE (Твой оригинал) ===== */
        if (!$('#iptv-style-default').length) {
            $('head').append('<style id="iptv-style-default">.iptv-root{display:flex;height:100vh;background:#0b0d10;color:#fff}.iptv-col{overflow:auto}.g{width:260px;padding:14px;background:#0e1116}.c{flex:1;padding:18px}.e{width:420px;padding:18px;background:#0e1116}.item{padding:14px;border-radius:12px;margin-bottom:8px;background:#15181d}.item.focus{background:#2962ff !important;outline:none}.chan{display:flex;align-items:center}.logo{width:64px;height:36px;background:#000;border-radius:8px;margin-right:14px;display:flex;align-items:center;justify-content:center}.logo img{max-width:100%;max-height:100%;object-fit:contain}.name{font-size:1.05em}.sub{font-size:.85em;color:#9aa0a6;margin-top:4px}.et{font-size:1.2em;margin-bottom:10px}.er{margin-bottom:8px;color:#cfcfcf}</style>');
        }

        /* ===== TV NAVIGATION ENGINE ===== */
        this.setupNavigator = function() {
            Lampa.Controller.add('iptv_component', {
                toggle: function() {
                    // Ищем активную колонку или фокусируем первую
                    var selectable = root.find('.selector');
                    Lampa.Controller.collectionSet(root);
                    Lampa.Controller.follow('up', _this.scrollUp);
                    Lampa.Controller.follow('down', _this.scrollDown);
                },
                left: function() {
                    Lampa.Controller.toggle('menu');
                },
                gone: function() {
                    // Когда компонент закрывается
                }
            });
        };

        this.scrollUp = function() {
            var current = $('.selector.focus');
            if(current.length) {
                var prev = current.prevAll('.selector').first();
                if(prev.length) Lampa.Controller.focus(prev[0]);
            }
        };

        this.scrollDown = function() {
            var current = $('.selector.focus');
            if(current.length) {
                var next = current.nextAll('.selector').first();
                if(next.length) Lampa.Controller.focus(next[0]);
            }
        };

        /* ===== CORE (Твои функции) ===== */
        this.create = function () {
            this.setupNavigator();
            renderGroups();
            loadPlaylist();
        };

        this.render = function () { return root; };

        this.start = function () {
            Lampa.Controller.enable('iptv_component');
            this.syncFocus(colG);
        };

        this.syncFocus = function(container) {
            var f = container.find('.selector').first();
            if (f.length) Lampa.Controller.focus(f[0]);
        };

        function addPlaylist() {
            Lampa.Input.edit({ title: 'Добавить плейлист (URL)', value: '', free: true }, function (u) {
                if (u && typeof u === 'string') {
                    playlists.push({ name: 'Плейлист ' + (playlists.length + 1), url: u.trim() });
                    Lampa.Storage.set('iptv_pl', playlists);
                    active = playlists.length - 1;
                    Lampa.Storage.set('iptv_pl_a', active);
                    loadPlaylist();
                }
            });
        }

        function loadPlaylist() {
            $.ajax({
                url: playlists[active].url,
                success: parseM3U,
                error: function () { Lampa.Noty.show('Ошибка загрузки'); }
            });
        }

        function parseM3U(str) {
            groups = { '⭐ Избранное': [] };
            all = [];
            str.split('\n').forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var m_name = (l.match(/,(.*)$/) || [,''])[1];
                    var m_id = (l.match(/tvg-id="([^"]+)"/i) || [,''])[1];
                    var m_logo = (l.match(/tvg-logo="([^"]+)"/i) || [,''])[1];
                    var m_group = (l.match(/group-title="([^"]+)"/i) || [,'ОБЩИЕ'])[1];
                    all.push({ name: m_name, id: m_id, logo: m_logo, group: m_group });
                } else if (l.indexOf('http') === 0 && all.length > 0) {
                    all[all.length-1].url = l;
                    var itm = all[all.length-1];
                    if (!groups[itm.group]) groups[itm.group] = [];
                    groups[itm.group].push(itm);
                }
            });
            groups['⭐ Избранное'] = all.filter(c => fav.includes(c.name));
            renderGroups();
        }

        function renderGroups() {
            colG.empty();
            $('<div class="selector item">➕ Добавить плейлист</div>').on('hover:enter', addPlaylist).appendTo(colG);
            Object.keys(groups).forEach(function (g) {
                $('<div class="selector item">' + g + '</div>').on('hover:enter', function () {
                    renderChannels(groups[g]);
                }).appendTo(colG);
            });
            _this.syncFocus(colG);
        }

        function renderChannels(list) {
            colC.empty(); colE.empty();
            list.forEach(function (c) {
                var row = $(`<div class="selector item chan"><div class="logo"><img src="${c.logo || 'https://bylampa.github.io/img/iptv.png'}"></div><div><div class="name">${c.name}</div><div class="sub">OK ▶</div></div></div>`);
                row.on('hover:focus', function () { updateInfo(c); });
                row.on('hover:enter', function () {
                    Lampa.Player.play({ url: c.url, title: c.name, type: 'tv', epg: true, epg_id: c.id || c.name });
                });
                colC.append(row);
            });
            _this.syncFocus(colC);
        }

        function updateInfo(c) {
            colE.empty();
            $('<div class="et">' + c.name + '</div>').appendTo(colE);
            var text = 'Программа загружается...';
            try {
                if (Lampa.TV && Lampa.TV.getEPG) {
                    var e = Lampa.TV.getEPG(c.id || c.name);
                    if (e && e.current) text = 'Сейчас: ' + e.current.title;
                }
            } catch (e) {}
            $('<div class="er">' + text + '</div>').appendTo(colE);
        }

        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { root.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv', IPTVComponent);
        $('.menu .menu__list').append($('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>').on('hover:enter', function () {
            Lampa.Activity.push({ title: 'IPTV', component: 'iptv' });
        }));
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();
