// ==Lampa==
// name: IPTV TV-Stable
// version: 5.3
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
        
        var playlists = Lampa.Storage.get('iptv_pl', [DEFAULT_PLAYLIST]);
        var active_pl = Lampa.Storage.get('iptv_pl_a', 0);
        var fav = Lampa.Storage.get('iptv_fav', []);
        var groups = {};

        // Исправленные стили
        if (!$('#iptv-style-final').length) {
            $('head').append(`
            <style id="iptv-style-final">
                .iptv-root { display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #0b0d10; z-index: 10; overflow: hidden; }
                .iptv-col { height: 100%; overflow-y: auto; padding: 20px 10px; box-sizing: border-box; }
                .iptv-col::-webkit-scrollbar { width: 0; }
                
                .g { width: 250px; background: #14171b; border-right: 2px solid #1f2328; }
                .c { flex: 1; background: #0b0d10; }
                .e { width: 350px; background: #080a0d; border-left: 2px solid #1f2328; }

                .item { padding: 12px 15px; margin-bottom: 8px; border-radius: 8px; cursor: pointer; border: 2px solid transparent; background: rgba(255,255,255,0.03); }
                .item.focus { background: #2962ff !important; border-color: #fff; transform: scale(1.02); }
                
                .chan { display: flex; align-items: center; }
                .logo { width: 50px; height: 30px; background: #000; margin-right: 12px; border-radius: 4px; flex-shrink: 0; overflow: hidden; }
                .logo img { width: 100%; height: 100%; object-fit: contain; }
                .name { font-size: 1.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                
                .info-content { padding: 20px; }
                .info-title { font-size: 1.8em; font-weight: bold; margin-bottom: 15px; }
            </style>`);
        }

        this.create = function () {
            root.append(colG, colC, colE);
            
            Lampa.Controller.add('iptv_plugin', {
                toggle: function () {
                    _this.updateNav();
                },
                left: function () {
                    var focused = root.find('.focus');
                    if (focused.closest('.g').length) Lampa.Activity.back();
                    else Lampa.Controller.move('left');
                },
                right: function() { Lampa.Controller.move('right'); },
                up: function() { Lampa.Controller.move('up'); },
                down: function() { Lampa.Controller.move('down'); },
                back: function() { Lampa.Activity.back(); }
            });

            this.load();
        };

        this.updateNav = function () {
            var items = root.find('.selector:visible');
            if (items.length) {
                Lampa.Controller.collectionSet(root);
                if (!root.find('.focus').length) Lampa.Controller.focus(items[0]);
            }
        };

        this.load = function () {
            colG.html('<div class="item">Загрузка...</div>');
            $.ajax({
                url: playlists[active_pl].url,
                success: function(str) { _this.parse(str); },
                error: function() { Lampa.Noty.show('Ошибка M3U'); }
            });
        };

        this.parse = function (str) {
            groups = { '⭐ Избранное': [] };
            var channels = [];
            var lines = str.split('\n');
            var cur = null;

            lines.forEach(function (l) {
                l = l.trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var n = (l.match(/,(.*)$/) || [,''])[1];
                    var lg = (l.match(/tvg-logo="([^"]+)"/i) || [,''])[1];
                    var g = (l.match(/group-title="([^"]+)"/i) || [,'ОБЩИЕ'])[1];
                    cur = { name: n, logo: lg, group: g };
                } else if (l.indexOf('http') === 0 && cur) {
                    cur.url = l;
                    channels.push(cur);
                    if (!groups[cur.group]) groups[cur.group] = [];
                    groups[cur.group].push(cur);
                    cur = null;
                }
            });
            groups['⭐ Избранное'] = channels.filter(c => fav.includes(c.name));
            this.renderG();
        };

        this.renderG = function () {
            colG.empty();
            // Кнопка настройки
            var set = $('<div class="selector item">⚙️ Плейлисты</div>').on('hover:enter', function() {
                Lampa.Input.edit({value: '', free: true, title: 'URL плейлиста'}, function(v) {
                    if(v) { playlists.push({name: 'New', url: v}); Lampa.Storage.set('iptv_pl', playlists); _this.load(); }
                });
            });
            colG.append(set);

            Object.keys(groups).forEach(function(g) {
                if (groups[g].length === 0 && g !== '⭐ Избранное') return;
                var item = $('<div class="selector item">' + g + '</div>');
                item.on('hover:enter', function() { _this.renderC(groups[g]); });
                item.on('hover:focus', function() { colE.html('<div class="info-content"><div class="info-title">'+g+'</div></div>'); });
                colG.append(item);
            });
            this.updateNav();
        };

        this.renderC = function (list) {
            colC.empty();
            list.forEach(function(c) {
                var row = $(`<div class="selector item chan"><div class="logo"><img src="${c.logo || ''}"></div><div class="name">${c.name}</div></div>`);
                row.on('hover:enter', function() {
                    Lampa.Player.play({ url: c.url, title: c.name });
                    if(!fav.includes(c.name)) { fav.push(c.name); Lampa.Storage.set('iptv_fav', fav); }
                });
                row.on('hover:focus', function() {
                    colE.html(`<div class="info-content"><div class="info-title">${c.name}</div><p>Нажмите ОК для просмотра</p></div>`);
                });
                colC.append(row);
            });
            this.updateNav();
            Lampa.Controller.focus(colC.find('.selector')[0]);
        };

        this.render = function () { return root; };
        this.start = function () {
            Lampa.Controller.toggle('iptv_plugin');
            // Даем ТВ время «продышаться»
            setTimeout(_this.updateNav, 100);
        };
        this.pause = this.stop = function () {};
        this.destroy = function () { root.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_stable', IPTVComponent);
        var item = $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>');
        item.on('hover:enter', function () { Lampa.Activity.push({ title: 'IPTV', component: 'iptv_stable' }); });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
