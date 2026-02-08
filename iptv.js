// ==Lampa==
// name: IPTV TV-Pro-Final
// version: 6.1
// author: Gemini & Artrax90
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var root, colG, colC, colE;
        var current_target = 'categories'; // Следим, где фокус: в категориях или каналах

        this.create = function () {
            root = $('<div class="iptv-root"></div>');
            colG = $('<div class="iptv-col g" data-selectable="true"></div>');
            colC = $('<div class="iptv-col c" data-selectable="true"></div>');
            colE = $('<div class="iptv-col e"></div>');
            root.append(colG, colC, colE);

            // Стили, проверенные на WebOS 3.0+ и Tizen
            if (!$('#iptv-v61-css').length) {
                $('head').append('<style id="iptv-v61-css">.iptv-root{display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:#0b0d10;z-index:1000}.iptv-col{height:100%;overflow-y:auto;position:relative}.g{width:300px;background:#14171b;border-right:1px solid #2a2e33}.c{flex:1;background:#0b0d10}.e{width:400px;background:#080a0d;border-left:1px solid #2a2e33;padding:30px}.item{padding:18px;margin:10px;border-radius:10px;background:rgba(255,255,255,0.05);color:#fff;font-size:1.3em;cursor:pointer;border:2px solid transparent}.item.focus{background:#2962ff!important;border-color:#fff;transform:scale(1.02)}.info-t{font-size:2em;font-weight:700;margin-bottom:20px;color:#fff}</style>');
            }

            this.load();
            return root;
        };

        this.load = function () {
            var url = 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u';
            $.ajax({
                url: url,
                success: function(str) { _this.parse(str); },
                error: function() { colG.html('<div class="item">Ошибка сети</div>'); }
            });
        };

        this.parse = function (str) {
            var groups = {};
            var channels = [];
            var lines = str.split('\n');

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
                        if (!groups[last.group]) groups[last.group] = [];
                        groups[last.group].push(last);
                    }
                }
            }
            this.renderG(groups);
        };

        this.renderG = function (groups) {
            colG.empty();
            Object.keys(groups).forEach(function(g) {
                var item = $('<div class="selector item">' + g + '</div>');
                item.on('hover:enter', function() { 
                    _this.renderC(groups[g]); 
                });
                // В профессиональных плагинах информация меняется по клику или с задержкой
                item.on('hover:focus', function() { 
                    colE.html('<div class="info-t">' + g + '</div>'); 
                });
                colG.append(item);
            });
            _this.refresh();
        };

        this.renderC = function (list) {
            colC.empty();
            list.forEach(function(c) {
                var row = $('<div class="selector item">' + c.name + '</div>');
                row.on('hover:enter', function() { 
                    Lampa.Player.play({url: c.url, title: c.name}); 
                });
                row.on('hover:focus', function() { 
                    colE.html('<div class="info-t">' + c.name + '</div><p>Нажмите ОК для просмотра</p>'); 
                });
                colC.append(row);
            });
            _this.refresh();
            current_target = 'channels';
            Lampa.Controller.focus(colC.find('.selector')[0]);
        };

        this.refresh = function() {
            Lampa.Controller.collectionSet(root);
        };

        this.start = function () {
            Lampa.Controller.add('iptv_final', {
                toggle: function () {
                    _this.refresh();
                },
                left: function () {
                    if (current_target === 'channels') {
                        current_target = 'categories';
                        Lampa.Controller.focus(colG.find('.focus')[0] || colG.find('.selector')[0]);
                    } else {
                        Lampa.Activity.back();
                    }
                },
                right: function () {
                    if (current_target === 'categories') {
                        var firstChan = colC.find('.selector')[0];
                        if (firstChan) {
                            current_target = 'channels';
                            Lampa.Controller.focus(firstChan);
                        }
                    }
                },
                up: function() { Lampa.Controller.move('up'); },
                down: function() { Lampa.Controller.move('down'); },
                back: function () { Lampa.Activity.back(); }
            });

            Lampa.Controller.toggle('iptv_final');
            
            // Фикс фокуса как в плагине "Лампа Каналы"
            setTimeout(function() {
                _this.refresh();
                var first = colG.find('.selector').first();
                if(first.length) Lampa.Controller.focus(first[0]);
            }, 300);
        };

        this.pause = this.stop = function () {};
        this.render = function () { return root; };
        this.destroy = function () { 
            Lampa.Controller.remove('iptv_final');
            root.remove(); 
        };
    }

    function init() {
        Lampa.Component.add('iptv_tv_new', IPTVComponent);
        var btn = $('<li class="menu__item selector"><div class="menu__text">IPTV PRO</div></li>');
        btn.on('hover:enter', function () {
            Lampa.Activity.push({title: 'IPTV', component: 'iptv_tv_new'});
        });
        $('.menu .menu__list').append(btn);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
