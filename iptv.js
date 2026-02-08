// ==Lampa==
// name: IPTV Ultimate Pro
// version: 8.0
// author: Gemini & Artrax90
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var root, colG, colC, colE;
        var groups_data = {};
        var current_list = [];
        var active_col = 'groups'; 
        var index_g = 0, index_c = 0;
        
        // Загрузка настроек из памяти
        var storage_key = 'iptv_pro_data';
        var config = Lampa.Storage.get(storage_key, {
            playlists: [{name: 'MEGA', url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'}],
            favorites: [],
            current_pl_index: 0
        });

        this.create = function () {
            root = $('<div class="iptv-root"></div>');
            var container = $('<div class="iptv-wrapper"></div>');
            
            colG = $('<div class="iptv-col col-groups"></div>');
            colC = $('<div class="iptv-col col-channels"></div>');
            colE = $('<div class="iptv-col col-details"></div>');
            
            container.append(colG, colC, colE);
            root.append(container);

            if (!$('#iptv-v8-style').length) {
                $('head').append(`
                <style id="iptv-v8-style">
                    .iptv-root { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: #0b0d10; z-index: 1000; padding-top: 5rem; box-sizing: border-box; }
                    .iptv-wrapper { display: flex; width: 100%; height: 100%; align-items: stretch; overflow: hidden; }
                    .iptv-col { height: 100%; overflow-y: auto; box-sizing: border-box; background: rgba(0,0,0,0.2); border-right: 1px solid rgba(255,255,255,0.1); }
                    .col-groups { width: 22rem; flex-shrink: 0; }
                    .col-channels { flex: 1; }
                    .col-details { width: 25rem; flex-shrink: 0; background: #080a0d; padding: 2rem; }
                    
                    .iptv-item { 
                        padding: 1rem 1.5rem; margin: 0.4rem 1rem; border-radius: 0.5rem; 
                        background: rgba(255,255,255,0.03); color: #fff; 
                        border: 2px solid transparent; cursor: pointer;
                        font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }
                    .iptv-item.active { background: #2962ff !important; border-color: #fff; transform: scale(1.02); }
                    .iptv-item.is-fav::before { content: '⭐ '; }
                    
                    .pl-manage { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center; }
                    .btn-add { background: #2962ff; color: #fff; padding: 0.5rem; border-radius: 5px; font-size: 0.9rem; cursor: pointer; }
                    
                    .info-title { font-size: 2rem; font-weight: bold; color: #fff; margin-bottom: 1rem; }
                    .info-desc { font-size: 1rem; color: rgba(255,255,255,0.5); line-height: 1.4; }
                </style>`);
            }

            this.loadPlaylist();
            return root;
        };

        this.loadPlaylist = function () {
            var current = config.playlists[config.current_pl_index];
            $.ajax({
                url: current.url,
                success: function(str) { _this.parse(str); },
                error: function() { 
                    Lampa.Noty.show('Ошибка загрузки плейлиста');
                    _this.parse(''); 
                }
            });
        };

        this.parse = function (str) {
            var lines = str.split('\n');
            groups_data = { '⭐ Избранное': [] }; 
            var all_channels = [];

            for (var i = 0; i < lines.length; i++) {
                var l = lines[i].trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var n = (l.match(/,(.*)$/) || [,''])[1];
                    var g = (l.match(/group-title="([^"]+)"/i) || [,'ОБЩИЕ'])[1];
                    all_channels.push({name: n, group: g, url: ''});
                } else if (l.indexOf('http') === 0 && all_channels.length > 0) {
                    var last = all_channels[all_channels.length - 1];
                    if (!last.url) {
                        last.url = l;
                        if (!groups_data[last.group]) groups_data[last.group] = [];
                        groups_data[last.group].push(last);
                    }
                }
            }

            // Фильтруем избранное
            groups_data['⭐ Избранное'] = all_channels.filter(c => config.favorites.some(f => f.url === c.url));
            this.renderG();
        };

        this.renderG = function () {
            colG.empty();
            // Кнопка управления плейлистами
            var manage = $('<div class="pl-manage"><div class="btn-add">Сменить / Добавить плейлист</div></div>');
            manage.on('click', this.managePlaylists);
            colG.append(manage);

            Object.keys(groups_data).forEach(function(g, i) {
                if (g !== '⭐ Избранное' && groups_data[g].length === 0) return;
                var item = $('<div class="iptv-item">' + g + '</div>');
                item.on('click', function() { index_g = i; active_col = 'groups'; _this.renderC(); });
                colG.append(item);
            });
            this.updateFocus();
        };

        this.managePlaylists = function() {
            Lampa.Select.show({
                title: 'Плейлисты',
                items: config.playlists.concat([{name: '+ Добавить новый', add: true}]),
                onSelect: function(item) {
                    if (item.add) {
                        Lampa.Input.show({
                            title: 'URL плейлиста',
                            value: '',
                            free: true,
                            onEnter: function(url) {
                                if (url) {
                                    config.playlists.push({name: 'Плейлист ' + (config.playlists.length + 1), url: url});
                                    _this.saveConfig();
                                    _this.loadPlaylist();
                                }
                            }
                        });
                    } else {
                        config.current_pl_index = config.playlists.indexOf(item);
                        _this.saveConfig();
                        _this.loadPlaylist();
                    }
                }
            });
        };

        this.renderC = function () {
            colC.empty();
            var g_name = Object.keys(groups_data)[index_g];
            current_list = groups_data[g_name] || [];
            current_list.forEach(function(c, i) {
                var is_fav = config.favorites.some(f => f.url === c.url);
                var row = $('<div class="iptv-item ' + (is_fav ? 'is-fav' : '') + '">' + c.name + '</div>');
                
                row.on('click', function() {
                    index_c = i; active_col = 'channels';
                    _this.updateFocus();
                    Lampa.Player.play({url: c.url, title: c.name});
                });
                
                // Долгое нажатие для ТВ и Браузера
                var timer;
                row.on('mousedown touchstart', function() {
                    timer = setTimeout(function() { _this.toggleFav(c); }, 800);
                }).on('mouseup mouseleave touchend', function() {
                    clearTimeout(timer);
                });

                colC.append(row);
            });
            this.updateFocus();
        };

        this.toggleFav = function(channel) {
            var fav_index = config.favorites.findIndex(f => f.url === channel.url);
            if (fav_index > -1) {
                config.favorites.splice(fav_index, 1);
                Lampa.Noty.show('Удалено из избранного');
            } else {
                config.favorites.push(channel);
                Lampa.Noty.show('Добавлено в избранное');
            }
            this.saveConfig();
            this.renderC();
            // Обновляем папку избранного в фоне
            var all = []; Object.values(groups_data).forEach(g => all = all.concat(g));
            groups_data['⭐ Избранное'] = config.favorites;
        };

        this.saveConfig = function() { Lampa.Storage.set(storage_key, config); };

        this.updateFocus = function () {
            $('.iptv-item').removeClass('active');
            var g_item = colG.find('.iptv-item').eq(index_g);
            var c_item = colC.find('.iptv-item').eq(index_c);

            if (active_col === 'groups') {
                g_item.addClass('active');
                if(g_item[0]) g_item[0].scrollIntoView({block: "center"});
                colE.html('<div class="info-title">' + g_item.text() + '</div><div class="info-desc">Зажмите ОК на канале, чтобы добавить в избранное.</div>');
            } else {
                c_item.addClass('active');
                if(c_item[0]) c_item[0].scrollIntoView({block: "center"});
                colE.html('<div class="info-title">' + current_list[index_c].name + '</div><div class="info-desc">Канал из группы ' + current_list[index_c].group + '</div>');
            }
        };

        this.start = function () {
            Lampa.Controller.add('iptv_pro', {
                toggle: function () {},
                up: function () {
                    if (active_col === 'groups') index_g = Math.max(0, index_g - 1);
                    else index_c = Math.max(0, index_c - 1);
                    _this.updateFocus();
                },
                down: function () {
                    if (active_col === 'groups') index_g = Math.min(colG.find('.iptv-item').length - 1, index_g + 1);
                    else index_c = Math.min(current_list.length - 1, index_c + 1);
                    _this.updateFocus();
                },
                right: function () { if (active_col === 'groups') { active_col = 'channels'; index_c = 0; _this.renderC(); } },
                left: function () { if (active_col === 'channels') { active_col = 'groups'; _this.updateFocus(); } else Lampa.Activity.back(); },
                enter: function () {
                    if (active_col === 'groups') { active_col = 'channels'; index_c = 0; _this.renderC(); }
                    else { Lampa.Player.play({url: current_list[index_c].url, title: current_list[index_c].name}); }
                },
                // Обработка долгого нажатия на пульте
                long: function() {
                    if (active_col === 'channels') _this.toggleFav(current_list[index_c]);
                },
                back: function () { Lampa.Activity.back(); }
            });
            Lampa.Controller.toggle('iptv_pro');
        };

        this.pause = this.stop = function () {};
        this.render = function () { return root; };
        this.destroy = function () { Lampa.Controller.remove('iptv_pro'); root.remove(); };
    }

    function init() {
        Lampa.Component.add('iptv_pro', IPTVComponent);
        var item = $('<li class="menu__item selector"><div class="menu__text">IPTV PRO</div></li>');
        item.on('hover:enter', function () { Lampa.Activity.push({title: 'IPTV', component: 'iptv_pro'}); });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
