// ==Lampa==
// name: IPTV Universal Hybrid
// version: 7.1
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
        var index_g = 0;
        var index_c = 0;

        this.create = function () {
            root = $('<div class="iptv-root"></div>');
            // Обертка для колонок, чтобы избежать наложения
            var container = $('<div class="iptv-container"></div>');
            
            colG = $('<div class="iptv-col g"></div>');
            colC = $('<div class="iptv-col c"></div>');
            colE = $('<div class="iptv-col e"></div>');
            
            container.append(colG, colC, colE);
            root.append(container);

            if (!$('#iptv-v71-style').length) {
                $('head').append(`
                <style id="iptv-v71-style">
                    .iptv-root { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0b0d10; z-index: 2000; overflow: hidden; }
                    .iptv-container { display: flex; width: 100%; height: 100%; }
                    .iptv-col { height: 100%; overflow-y: auto; overflow-x: hidden; box-sizing: border-box; display: flex; flex-direction: column; }
                    
                    /* Фиксированные ширины для исключения наложения */
                    .g { width: 300px; background: #14171b; border-right: 1px solid #2a2e33; flex-shrink: 0; }
                    .c { flex: 1; background: #0b0d10; border-right: 1px solid #2a2e33; }
                    .e { width: 400px; background: #080a0d; padding: 30px; flex-shrink: 0; }
                    
                    .item { 
                        padding: 15px 20px; margin: 5px 10px; border-radius: 8px; 
                        background: rgba(255,255,255,0.05); color: #fff; 
                        border: 2px solid transparent; cursor: pointer;
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                        flex-shrink: 0;
                    }
                    .item.active { background: #2962ff !important; border-color: #fff; box-shadow: 0 0 15px rgba(41,98,255,0.5); }
                    .info-title { font-size: 2em; font-weight: bold; color: #fff; margin-bottom: 20px; }
                    .info-desc { font-size: 1.2em; color: #aaa; line-height: 1.4; }
                </style>`);
            }

            this.load();
            return root;
        };

        this.load = function () {
            $.ajax({
                url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u',
                success: function(str) { _this.parse(str); },
                error: function() { colG.html('<div class="item">Ошибка загрузки</div>'); }
            });
        };

        this.parse = function (str) {
            var lines = str.split('\n');
            var channels = [];
            groups_data = {}; 

            for (var i = 0; i < lines.length; i++) {
                var l = lines[i].trim();
                if (l.indexOf('#EXTINF') === 0) {
                    var n = (l.match(/,(.*)$/) || [,''])[1];
                    var g = (l.match(/group-title="([^"]+)"/i) || [,'ОБЩИЕ'])[1];
                    channels.push({name: n, group: g, url: ''});
                } else if (l.indexOf('http') === 0 && channels.length > 0) {
                    var last = channels[channels.length - 1];
                    if (!last.url) {
                        last.url = l;
                        if (!groups_data[last.group]) groups_data[last.group] = [];
                        groups_data[last.group].push(last);
                    }
                }
            }
            this.renderG();
        };

        this.renderG = function () {
            colG.empty();
            Object.keys(groups_data).forEach(function(g, i) {
                var item = $('<div class="item">' + g + '</div>');
                // Поддержка мышки
                item.on('click', function() {
                    index_g = i;
                    active_col = 'groups';
                    _this.renderC();
                });
                colG.append(item);
            });
            this.updateFocus();
        };

        this.renderC = function () {
            colC.empty();
            var g_name = Object.keys(groups_data)[index_g];
            current_list = groups_data[g_name] || [];
            current_list.forEach(function(c, i) {
                var row = $('<div class="item">' + c.name + '</div>');
                // Поддержка мышки
                row.on('click', function() {
                    index_c = i;
                    active_col = 'channels';
                    _this.updateFocus();
                    Lampa.Player.play({url: c.url, title: c.name});
                });
                colC.append(row);
            });
            this.updateFocus();
        };

        this.updateFocus = function () {
            colG.find('.item').removeClass('active');
            colC.find('.item').removeClass('active');

            var g_item = colG.find('.item').eq(index_g);
            var c_item = colC.find('.item').eq(index_c);

            if (active_col === 'groups') {
                g_item.addClass('active');
                // Центрируем скролл
                if(g_item[0]) g_item[0].scrollIntoView({block: "center", behavior: "smooth"});
                colE.html('<div class="info-title">' + g_item.text() + '</div><div class="info-desc">Категория выбрана. Нажмите ОК или Вправо, чтобы увидеть каналы.</div>');
            } else {
                c_item.addClass('active');
                if(c_item[0]) c_item[0].scrollIntoView({block: "center", behavior: "smooth"});
                var chan = current_list[index_c];
                colE.html('<div class="info-title">' + (chan ? chan.name : '') + '</div><div class="info-desc">Канал выбран. Нажмите ОК для запуска трансляции.</div>');
            }
        };

        this.start = function () {
            Lampa.Controller.add('iptv_hybrid', {
                toggle: function () {},
                up: function () {
                    if (active_col === 'groups') index_g = Math.max(0, index_g - 1);
                    else index_c = Math.max(0, index_c - 1);
                    _this.updateFocus();
                },
                down: function () {
                    if (active_col === 'groups') index_g = Math.min(Object.keys(groups_data).length - 1, index_g + 1);
                    else index_c = Math.min(current_list.length - 1, index_c + 1);
                    _this.updateFocus();
                },
                right: function () {
                    if (active_col === 'groups') {
                        active_col = 'channels';
                        index_c = 0;
                        _this.renderC();
                    }
                },
                left: function () {
                    if (active_col === 'channels') {
                        active_col = 'groups';
                        _this.updateFocus();
                    } else {
                        Lampa.Activity.back();
                    }
                },
                enter: function () {
                    if (active_col === 'groups') {
                        active_col = 'channels';
                        index_c = 0;
                        _this.renderC();
                    } else {
                        var chan = current_list[index_c];
                        if (chan) Lampa.Player.play({url: chan.url, title: chan.name});
                    }
                },
                back: function () { Lampa.Activity.back(); }
            });
            Lampa.Controller.toggle('iptv_hybrid');
        };

        this.pause = this.stop = function () {};
        this.render = function () { return root; };
        this.destroy = function () { 
            Lampa.Controller.remove('iptv_hybrid');
            root.remove(); 
        };
    }

    function init() {
        Lampa.Component.add('iptv_hybrid', IPTVComponent);
        var item = $('<li class="menu__item selector"><div class="menu__text">IPTV PRO</div></li>');
        item.on('hover:enter', function () {
            Lampa.Activity.push({title: 'IPTV', component: 'iptv_hybrid'});
        });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
