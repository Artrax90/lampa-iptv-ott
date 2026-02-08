// ==Lampa==
// name: IPTV Ultra Stable
// version: 5.8
// author: Artrax90 & Gemini
// ==/Lampa==

(function () {
    'use strict';

    function IPTVComponent(object) {
        var _this = this;
        var root, colG, colC, colE;
        var scrollG, scrollC;
        var last_group = [];

        this.create = function () {
            // Защита от пустых данных
            var playlists = Lampa.Storage.get('iptv_pl', []);
            if(!playlists.length) playlists = [{name: 'MEGA', url: 'https://raw.githubusercontent.com/loganettv/playlists/refs/heads/main/mega.m3u'}];
            
            root = $('<div class="iptv-root"></div>');
            colG = $('<div class="iptv-col g"></div>');
            colC = $('<div class="iptv-col c"></div>');
            colE = $('<div class="iptv-col e"></div>');
            
            root.append(colG, colC, colE);

            if (!$('#iptv-style-v58').length) {
                $('head').append(`
                <style id="iptv-style-v58">
                    .iptv-root { display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0b0d10; z-index: 10; overflow: hidden; }
                    .iptv-col { height: 100%; overflow-y: auto; display: flex; flex-direction: column; }
                    .g { width: 250px; background: #14171b; border-right: 1px solid #2a2e33; }
                    .c { flex: 1; background: #0b0d10; }
                    .e { width: 350px; background: #080a0d; border-left: 1px solid #2a2e33; padding: 20px; }
                    .item { padding: 15px; margin: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); color: #fff; border: 2px solid transparent; flex-shrink: 0; }
                    .item.focus { background: #2962ff !important; border-color: #fff; }
                    .info-title { font-size: 1.6em; font-weight: bold; margin-bottom: 15px; color: #fff; }
                </style>`);
            }

            this.load(playlists[0].url);
            return root;
        };

        this.load = function (url) {
            colG.html('<div class="item">Загрузка...</div>');
            $.ajax({
                url: url,
                success: function(str) { _this.parse(str); },
                error: function() { colG.html('<div class="item">Ошибка загрузки</div>'); }
            });
        };

        this.parse = function (str) {
            var groups = {'⭐ Избранное': []};
            var channels = [];
            var fav = Lampa.Storage.get('iptv_fav', []);
            
            str.split('\n').forEach(function(l){
                if(l.indexOf('#EXTINF') === 0){
                    var n = (l.match(/,(.*)$/)||[,''])[1];
                    var g = (l.match(/group-title="([^"]+)"/i)||[,'ОБЩИЕ'])[1];
                    channels.push({name: n, group: g, url: ''});
                } else if(l.indexOf('http') === 0 && channels.length > 0){
                    var last = channels[channels.length-1];
                    if(!last.url) {
                        last.url = l.trim();
                        if(!groups[last.group]) groups[last.group] = [];
                        groups[last.group].push(last);
                    }
                }
            });
            groups['⭐ Избранное'] = channels.filter(c => fav.includes(c.name));
            this.renderG(groups);
        };

        this.renderG = function (groups) {
            colG.empty();
            Object.keys(groups).forEach(function(g){
                if(groups[g].length === 0 && g !== '⭐ Избранное') return;
                var item = $('<div class="selector item" data-selectable="true">'+g+'</div>');
                item.on('hover:enter', function(){ _this.renderC(groups[g]); });
                item.on('hover:focus', function(){ colE.html('<div class="info-title">'+g+'</div>'); });
                colG.append(item);
            });
            _this.refresh();
        };

        this.renderC = function (list) {
            colC.empty();
            list.forEach(function(c){
                var row = $('<div class="selector item" data-selectable="true">'+c.name+'</div>');
                row.on('hover:enter', function(){
                    Lampa.Player.play({url: c.url, title: c.name});
                });
                row.on('hover:focus', function(){ colE.html('<div class="info-title">'+c.name+'</div>'); });
                colC.append(row);
            });
            _this.refresh();
            Lampa.Controller.focus(colC.find('.selector')[0]);
        };

        this.refresh = function() {
            Lampa.Controller.collectionSet(root);
        };

        this.start = function () {
            Lampa.Controller.add('iptv_ultra', {
                toggle: function () { _this.refresh(); },
                left: function() { Lampa.Controller.move('left'); },
                right: function() { Lampa.Controller.move('right'); },
                up: function() { Lampa.Controller.move('up'); },
                down: function() { Lampa.Controller.move('down'); },
                back: function() { Lampa.Activity.back(); }
            });
            Lampa.Controller.toggle('iptv_ultra');
            
            // Фикс задержки для фокуса на ТВ
            setTimeout(function(){
                var f = colG.find('.selector')[0];
                if(f) Lampa.Controller.focus(f);
            }, 300);
        };

        this.pause = this.stop = function () {};
        this.render = function () { return root; };
        this.destroy = function () { 
            Lampa.Controller.remove('iptv_ultra');
            root.remove(); 
        };
    }

    function init() {
        Lampa.Component.add('iptv_ultra', IPTVComponent);
        var item = $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>');
        item.on('hover:enter', function () {
            Lampa.Activity.push({title: 'IPTV', component: 'iptv_ultra'});
        });
        $('.menu .menu__list').append(item);
    }

    if (window.app_ready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') init(); });
})();
