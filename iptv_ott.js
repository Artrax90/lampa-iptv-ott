// ==Lampa==
// name: IPTV TiviMate Pro
// version: 1.4.3
// description: TiviMate Style + Direct EPG (iptvx.one)
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var items = $('<div class="tivimate-container"></div>');
        var groups = {};
        var favorites = Lampa.Storage.get('iptv_fav_list', []);
        var epg_cache = {}; // Кэш для программы передач

        if (!$('#tivimate-styles').length) {
            $('head').append('<style id="tivimate-styles">' +
                '.tivimate-container { width:100%; height: 100vh; overflow-y: auto; padding: 20px 40px; box-sizing: border-box; background: #0f1216; position: absolute; top:0; left:0; right:0; bottom:0; z-index: 1000; }' +
                '.tivimate-container::-webkit-scrollbar { width: 0px; }' +
                '.tv-item { display: flex; align-items: center; padding: 12px 18px; background: rgba(255,255,255,0.02); margin-bottom: 8px; border-radius: 6px; border-left: 4px solid transparent; transition: all 0.15s ease-out; cursor: pointer; }' +
                '.tv-item.focus { background: rgba(52, 152, 219, 0.25) !important; border-left-color: #3498db; transform: scale(1.02); box-shadow: 0 10px 20px rgba(0,0,0,0.4); }' +
                '.tv-logo { width: 55px; height: 35px; margin-right: 20px; background: #000; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 0 5px rgba(255,255,255,0.1); }' +
                '.tv-logo img { max-width: 90%; max-height: 90%; object-fit: contain; }' +
                '.tv-info { flex-grow: 1; overflow: hidden; }' +
                '.tv-name { font-size: 1.2em; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }' +
                '.tv-epg-text { font-size: 0.85em; color: #3498db; margin-top: 4px; opacity: 0.9; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
                '.tv-fav { color: #f1c40f; margin-left: 15px; font-size: 1.1em; opacity: 0.1; transition: opacity 0.2s; }' +
                '.tv-item.is-fav .tv-fav { opacity: 1; }' +
                '.group-title { font-size: 0.9em; color: rgba(52, 152, 219, 0.8); text-transform: uppercase; margin: 30px 0 15px 5px; letter-spacing: 2px; font-weight: bold; }' +
                '/* Полная очистка интерфейса */' +
                '.activity__footer, .pwa-install, .layer--footer, .is--iframe .layer--footer { display: none !important; opacity: 0 !important; visibility: hidden !important; }' +
                '</style>');
        }

        function getSafeUrl(url) {
            if (!url) return '';
            if (url.indexOf('http') !== 0) return url;
            // Всегда прогоняем через прокси для Chrome и обхода Mixed Content
            return 'https://corsproxy.io/?' + encodeURIComponent(url);
        }

        // Загрузка EPG
        this.loadEPG = function() {
            // Используем системный метод Лампы для интеграции с внешним EPG
            if (window.Lampa && Lampa.TV) {
                Lampa.TV.addSource('iptvx', 'https://iptvx.one/EPG');
            }
        };

        function createItem(chan, type) {
            var isChan = type === 'channel';
            var logo_url = isChan ? getSafeUrl(chan.logo || chan['tvg-logo'] || chan['url-tvg']) : '';
            var isFavorite = isChan && favorites.some(f => f.url === chan.url);
            
            var epg_line = 'Загрузка программы...';
            if (isChan) {
                // Если в Лампе есть данные по этому каналу
                var info = Lampa.TV ? Lampa.TV.getEPG(chan.name) : null;
                epg_line = (info && info.current) ? info.current.title : 'Нет данных о передаче';
            }
            
            var item = $('<div class="selector tv-item ' + (isFavorite ? 'is-fav' : '') + '">' +
                (isChan ? '<div class="tv-logo">' + (logo_url ? '<img src="' + logo_url + '">' : '<span style="font-size:10px">TV</span>') + '</div>' : '') +
                '<div class="tv-info">' +
                    '<span class="tv-name">' + (isChan ? chan.name : chan) + '</span>' +
                    (isChan ? '<div class="tv-epg-text">' + epg_line + '</div>' : '') +
                '</div>' +
                (isChan ? '<div class="tv-fav">★</div>' : '') +
            '</div>');

            return item;
        }

        this.create = function () {
            this.loadEPG();
            var url = Lampa.Storage.get('iptv_m3u_link', '');
            if (!url) this.renderInputPage();
            else this.loadPlaylist(url);
        };

        this.loadPlaylist = function(url) {
            items.empty().append('<div style="text-align:center; padding:100px; color:#fff; font-size:1.5em; opacity:0.3;">TIVIMATE PRO</div>');
            $.ajax({
                url: getSafeUrl(url),
                method: 'GET',
                success: function(str) { _this.parse(str); _this.renderGroups(); },
                error: function() { Lampa.Noty.show('Ошибка плейлиста'); _this.renderInputPage(); }
            });
        };

        this.parse = function (str) {
            groups = {'Все каналы': []};
            var lines = str.split('\n');
            var current = null;
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf('#EXTINF') === 0) {
                    current = {};
                    current.name = line.match(/,(.*)$/)?.[1].trim() || 'Без названия';
                    current.logo = line.match(/(?:tvg-logo|logo|url-tvg)="([^"]+)"/i)?.[1] || '';
                    current.group = line.match(/group-title="([^"]+)"/i)?.[1] || 'Разное';
                } else if (line.indexOf('http') === 0 && current) {
                    current.url = line;
                    if (!groups[current.group]) groups[current.group] = [];
                    groups[current.group].push(current);
                    groups['Все каналы'].push(current);
                    current = null;
                }
            }
        };

        this.renderGroups = function () {
            items.empty();
            items.append('<div class="group-title">Основное</div>');
            items.append(createItem('🔍 ПОИСК ПО КАНАЛАМ', 'nav').on('hover:enter', function() {
                Lampa.Input.edit({title:'TiviMate Search', value:'', free:true}, function(v) {
                    if(v) _this.renderChannelList(groups['Все каналы'].filter(c => c.name.toLowerCase().includes(v.toLowerCase())), 'Результаты поиска');
                });
            }));
            
            if(favorites.length > 0) {
                items.append('<div class="group-title">Избранное</div>');
                items.append(createItem('⭐ МОИ КАНАЛЫ', 'nav').on('hover:enter', function() { _this.renderChannelList(favorites, 'Избранное'); }));
            }

            items.append('<div class="group-title">Категории</div>');
            Object.keys(groups).sort().forEach(function (g) {
                if (g === 'Все каналы' && Object.keys(groups).length > 2) return;
                createItem(g + ' (' + groups[g].length + ')', 'nav').appendTo(items).on('hover:enter', function() {
                    _this.renderChannelList(groups[g], g);
                });
            });
            
            items.append('<div style="height:50px"></div>'); // Отступ снизу
            this.refresh();
        };

        this.renderChannelList = function (list, title) {
            items.empty();
            createItem('🔙 НАЗАД К КАТЕГОРИЯМ', 'nav').appendTo(items).on('hover:enter', function() { _this.renderGroups(); });
            items.append('<div class="group-title">' + title + '</div>');
            
            list.forEach(function (chan) {
                var cItem = createItem(chan, 'channel').appendTo(items);
                cItem.on('hover:enter', function() {
                    var p_url = chan.url;
                    if (window.location.protocol === 'https:' && p_url.indexOf('https') === -1) {
                        if (Lampa.Utils && Lampa.Utils.proxyUrl) p_url = Lampa.Utils.proxyUrl(p_url);
                    }
                    Lampa.Player.play({ url: p_url, title: chan.name });
                    Lampa.Player.playlist(list.map(c => ({title: c.name, url: c.url})));
                });
                cItem.on('hover:long', function() {
                    var idx = favorites.findIndex(f => f.url === chan.url);
                    if(idx > -1) favorites.splice(idx, 1); else favorites.push(chan);
                    Lampa.Storage.set('iptv_fav_list', favorites);
                    Lampa.Noty.show('TiviMate: Список обновлен');
                    _this.renderChannelList(list, title);
                });
            });
            this.refresh();
        };

        this.renderInputPage = function() {
            items.empty().append('<div class="group-title">Настройка плейлиста</div>');
            createItem('➕ Ввести URL плейлиста (M3U)', 'nav').appendTo(items).on('hover:enter', function() {
                Lampa.Input.edit({ value: Lampa.Storage.get('iptv_m3u_link', ''), free: true }, function(new_val) {
                    if(new_val) { Lampa.Storage.set('iptv_m3u_link', new_val); _this.loadPlaylist(new_val); }
                });
            });
            this.refresh();
        };

        this.refresh = function() {
            Lampa.Controller.enable('content');
            items.scrollTop(0);
            setTimeout(function() {
                var f = items.find('.selector').first();
                if(f.length) Lampa.Controller.focus(f[0]);
            }, 200);
        };

        this.render = function () { return items; };
        this.start = function () { Lampa.Controller.enable('content'); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { items.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_lite', IPTVComponent);
        var item = $('<li class="menu__item selector" data-action="iptv_lite"><div class="menu__ico"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 8 15z" fill="currentColor"/></svg></div><div class="menu__text">TiviMate Pro</div></li>');
        item.on('hover:enter', function () { Lampa.Activity.push({ title: 'TiviMate Pro', component: 'iptv_lite', page: 1 }); });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
