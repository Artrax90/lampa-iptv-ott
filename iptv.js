// ==Lampa==
// name: IPTV TiviMate (EPG Right, Kulik XMLTV)
// version: 4.0.0
// description: IPTV with right EPG panel, XMLTV via kulik proxy, logos by tvg-id
// author: Artrax90
// ==/Lampa==

(function () {
  'use strict';

  function IPTVComponent() {
    var root = $('<div class="iptv-root"></div>');
    var colGroups = $('<div class="iptv-col iptv-groups"></div>');
    var colChannels = $('<div class="iptv-col iptv-channels"></div>');
    var colEpg = $('<div class="iptv-col iptv-epg"></div>');
    root.append(colGroups, colChannels, colEpg);

    // ====== STATE ======
    var playlists = Lampa.Storage.get('iptv_playlists', []);
    var activeIndex = Lampa.Storage.get('iptv_active_playlist', 0);
    var favorites = Lampa.Storage.get('iptv_fav', []);
    var groups = {};
    var allChannels = [];
    var currentList = [];

    // ====== EPG (XMLTV via kulik) ======
    var KULIK = 'https://cdn.kulik.uz/cors?url=';
    var EPG_URL = 'https://iptvx.one/EPG'; // xmltv
    var epgLoaded = false;
    var epgChannels = {};   // channelId -> { icon }
    var epgPrograms = {};  // channelId -> [{start, stop, title, desc}]
    var epgByTime = function (cid, now) {
      var list = epgPrograms[cid] || [];
      var cur = null, next = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].start <= now && now < list[i].stop) {
          cur = list[i];
          next = list[i + 1] || null;
          break;
        }
      }
      return { cur: cur, next: next };
    };

    // ====== STYLES ======
    if (!$('#iptv-style').length) {
      $('head').append(`
      <style id="iptv-style">
      .iptv-root{display:flex;height:100vh;background:#0b0d10;color:#fff;font-family:Roboto,Arial}
      .iptv-col{overflow:auto}
      .iptv-groups{width:260px;padding:16px;background:#0e1116}
      .iptv-channels{flex:1;padding:20px}
      .iptv-epg{width:420px;padding:20px;background:#0e1116}

      .iptv-item{padding:14px;border-radius:12px;margin-bottom:10px;background:#15181d}
      .iptv-item.focus{background:#2962ff}
      .iptv-channel{display:flex;align-items:center}
      .iptv-logo{width:64px;height:36px;background:#000;border-radius:8px;display:flex;align-items:center;justify-content:center;margin-right:14px}
      .iptv-logo img{max-width:90%;max-height:90%;object-fit:contain}
      .iptv-name{font-size:1.05em}
      .iptv-sub{font-size:.85em;color:#9aa0a6;margin-top:4px}

      .epg-title{font-size:1.2em;margin-bottom:10px}
      .epg-row{margin-bottom:8px}
      .epg-now{font-weight:600}
      .epg-btn{margin-top:16px;padding:12px;border-radius:10px;background:#15181d}
      .epg-btn.focus{background:#2962ff}
      </style>
      `);
    }

    // ====== HELPERS ======
    function focus(box){
      Lampa.Controller.enable('content');
      var f = box.find('.selector').first();
      if (f.length) Lampa.Controller.focus(f[0]);
    }
    function parseTime(t){
      // XMLTV format: YYYYMMDDhhmmss +0000
      var m = t.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      if(!m) return 0;
      return Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
    }

    // ====== XMLTV LOAD ======
    function loadEPG(cb){
      if (epgLoaded) return cb && cb();
      $.ajax({
        url: KULIK + encodeURIComponent(EPG_URL),
        success: function(xml){
          var $xml = $(xml);
          $xml.find('channel').each(function(){
            var id = $(this).attr('id');
            var icon = $(this).find('icon').attr('src') || '';
            epgChannels[id] = { icon: icon };
          });
          $xml.find('programme').each(function(){
            var cid = $(this).attr('channel');
            if(!epgPrograms[cid]) epgPrograms[cid] = [];
            epgPrograms[cid].push({
              start: parseTime($(this).attr('start')),
              stop: parseTime($(this).attr('stop')),
              title: $(this).find('title').first().text() || '',
              desc: $(this).find('desc').first().text() || ''
            });
          });
          epgLoaded = true;
          cb && cb();
        },
        error: function(){ epgLoaded = true; cb && cb(); }
      });
    }

    // ====== CORE ======
    this.create = function(){
      if(!playlists.length) return addPlaylist();
      loadActive();
    };
    this.render = function(){ return root; };
    this.start = function(){ focus(colGroups); };
    this.destroy = function(){ root.remove(); };

    function restart(){
      Lampa.Activity.close();
      setTimeout(function(){
        Lampa.Activity.push({ title:'IPTV', component:'iptv_lite' });
      },50);
    }
    function addPlaylist(){
      Lampa.Input.edit({ title:'Добавить плейлист (URL)', value:'', free:true }, function(url){
        if(!url) return;
        playlists.push({ name:'Плейлист '+(playlists.length+1), url:url });
        Lampa.Storage.set('iptv_playlists', playlists);
        activeIndex = playlists.length-1;
        Lampa.Storage.set('iptv_active_playlist', activeIndex);
        restart();
      });
    }
    function playlistMenu(){
      var items = playlists.map(function(p,i){
        return { title:(i===activeIndex?'✔ ':'')+p.name, onSelect:function(){
          activeIndex=i; Lampa.Storage.set('iptv_active_playlist',i); loadActive();
        }};
      });
      items.push({ title:'➕ Добавить плейлист', onSelect:function(){ setTimeout(addPlaylist,50);} });
      Lampa.Select.show({ title:'Плейлисты', items:items });
    }

    function loadActive(){
      var pl = playlists[activeIndex];
      $.ajax({
        url: pl.url,
        success: function(str){ parseM3U(str); renderGroups(); },
        error: function(){
          $.ajax({ url: KULIK+encodeURIComponent(pl.url), success:function(s){ parseM3U(s); renderGroups(); }});
        }
      });
    }

    function parseM3U(str){
      groups = { '⭐ Избранное':[] };
      allChannels = [];
      var cur=null;
      str.split('\n').forEach(function(l){
        l=l.trim();
        if(l.indexOf('#EXTINF')===0){
          cur={
            name: (l.match(/,(.*)$/)||[])[1]||'',
            tvg_id: (l.match(/tvg-id="([^"]+)"/i)||[])[1]||'',
            group: (l.match(/group-title="([^"]+)"/i)||[])[1]||'ОБЩИЕ'
          };
        } else if(l.indexOf('http')===0 && cur){
          cur.url=l;
          allChannels.push(cur);
          if(!groups[cur.group]) groups[cur.group]=[];
          groups[cur.group].push(cur);
          cur=null;
        }
      });
      rebuildFav();
    }
    function rebuildFav(){
      groups['⭐ Избранное'] = allChannels.filter(c=>favorites.includes(c.name));
    }

    function renderGroups(){
      colGroups.empty();
      $('<div class="selector iptv-item">📂 Плейлисты</div>').on('hover:enter', playlistMenu).appendTo(colGroups);
      Object.keys(groups).forEach(function(g){
        $('<div class="selector iptv-item">'+g+'</div>').on('hover:enter', function(){
          currentList = groups[g];
          renderChannels(currentList);
        }).appendTo(colGroups);
      });
      focus(colGroups);
    }

    function renderChannels(list){
      colChannels.empty(); currentList=list;
      list.forEach(function(c){
        var row = $(`
          <div class="selector iptv-item iptv-channel">
            <div class="iptv-logo"><img></div>
            <div>
              <div class="iptv-name">${c.name}</div>
              <div class="iptv-sub">OK — ▶</div>
            </div>
          </div>
        `);

        row.on('hover:focus', function(){
          loadEPG(function(){ updateEpgPanel(c); });
        });

        row.on('hover:enter', function(){
          Lampa.Player.play({ url:c.url, title:c.name, type:'tv', epg:EPG_URL, epg_id:c.tvg_id });
        });

        // set logo from XMLTV by tvg-id
        if (c.tvg_id && epgChannels[c.tvg_id] && epgChannels[c.tvg_id].icon){
          row.find('img').attr('src', epgChannels[c.tvg_id].icon);
        } else {
          row.find('img').attr('src','https://bylampa.github.io/img/iptv.png');
        }

        colChannels.append(row);
      });
      focus(colChannels);
    }

    function updateEpgPanel(c){
      colEpg.empty();
      $('<div class="epg-title">'+c.name+'</div>').appendTo(colEpg);

      var now = Date.now();
      var data = c.tvg_id ? epgByTime(c.tvg_id, now) : {cur:null,next:null};

      if(data.cur){
        $('<div class="epg-row epg-now">Сейчас: '+data.cur.title+'</div>').appendTo(colEpg);
        if(data.next) $('<div class="epg-row">Далее: '+data.next.title+'</div>').appendTo(colEpg);
      } else {
        $('<div class="epg-row">Нет программы</div>').appendTo(colEpg);
      }

      $('<div class="selector epg-btn">'+(favorites.includes(c.name)?'⭐ Убрать из избранного':'⭐ В избранное')+'</div>')
        .on('hover:enter', function(){
          if(favorites.includes(c.name)) favorites=favorites.filter(x=>x!==c.name);
          else favorites.push(c.name);
          Lampa.Storage.set('iptv_fav', favorites);
          rebuildFav(); renderGroups();
        }).appendTo(colEpg);

      focus(colChannels);
    }
  }

  function init(){
    Lampa.Component.add('iptv_lite', IPTVComponent);
    var btn=$('<li class="menu__item selector"><div class="menu__ico">📺</div><div class="menu__text">IPTV</div></li>');
    btn.on('hover:enter', function(){ Lampa.Activity.push({ title:'IPTV', component:'iptv_lite' }); });
    $('.menu .menu__list').append(btn);
  }

  if(window.app_ready) init();
  else Lampa.Listener.follow('app', function(e){ if(e.type==='ready') init(); });

})();
