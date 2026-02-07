// ==Lampa==
// name: IPTV TiviMate EPG Right (FIXED)
// version: 4.1.1
// author: Artrax90
// ==/Lampa==

(function () {
  'use strict';

  function IPTV() {
    var root = $('<div class="iptv-root"></div>');
    var colG = $('<div class="iptv-col g"></div>');
    var colC = $('<div class="iptv-col c"></div>');
    var colE = $('<div class="iptv-col e"></div>');
    root.append(colG, colC, colE);

    var KULIK = 'https://cdn.kulik.uz/cors?url=';
    var EPG_URL = 'https://iptvx.one/EPG';

    var playlists = Lampa.Storage.get('iptv_pl', []);
    var active = Lampa.Storage.get('iptv_pl_a', 0);
    var fav = Lampa.Storage.get('iptv_fav', []);

    var groups = {};
    var all = [];

    var epgReady = false;
    var epgIcons = {};
    var epgProg = {};

    /* ---------- STYLE ---------- */
    if (!$('#iptv-style-fix').length) {
      $('head').append(`
      <style id="iptv-style-fix">
      .iptv-root{display:flex;height:100vh;background:#0b0d10;color:#fff}
      .iptv-col{overflow:auto}
      .g{width:260px;padding:14px;background:#0e1116}
      .c{flex:1;padding:18px}
      .e{width:420px;padding:18px;background:#0e1116}
      .item{padding:14px;border-radius:12px;margin-bottom:8px;background:#15181d}
      .item.focus{background:#2962ff}
      .chan{display:flex;align-items:center}
      .logo{width:64px;height:36px;background:#000;border-radius:8px;margin-right:14px;display:flex;align-items:center;justify-content:center}
      .logo img{max-width:90%;max-height:90%}
      .name{font-size:1.05em}
      .sub{font-size:.85em;color:#9aa0a6;margin-top:4px}
      .et{font-size:1.2em;margin-bottom:10px}
      .er{margin-bottom:8px}
      </style>`);
    }

    /* ---------- HELPERS ---------- */
    function focus(box){
      Lampa.Controller.enable('content');
      var f = box.find('.selector').first();
      if(f.length) Lampa.Controller.focus(f[0]);
    }

    function parseTime(t){
      var m=t.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
      return m ? Date.UTC(m[1],m[2]-1,m[3],m[4],m[5],m[6]) : 0;
    }

    /* ---------- XMLTV ---------- */
    function loadEPG(cb){
      if(epgReady) return cb();
      $.ajax({
        url: KULIK + encodeURIComponent(EPG_URL),
        success: function(xml){
          var doc = $.parseXML(xml);
          var $x = $(doc);

          $x.find('channel').each(function(){
            var id=$(this).attr('id');
            var ic=$(this).find('icon').attr('src');
            if(ic) epgIcons[id]=ic;
          });

          $x.find('programme').each(function(){
            var id=$(this).attr('channel');
            if(!epgProg[id]) epgProg[id]=[];
            epgProg[id].push({
              s:parseTime($(this).attr('start')),
              e:parseTime($(this).attr('stop')),
              t:$(this).find('title').first().text()
            });
          });

          epgReady=true;
          cb();
        },
        error:function(){epgReady=true;cb();}
      });
    }

    function getNow(id){
      var n=Date.now(),p=epgProg[id]||[];
      for(var i=0;i<p.length;i++){
        if(p[i].s<=n&&n<p[i].e) return p[i];
      }
      return null;
    }

    /* ---------- CORE ---------- */
    this.create=function(){
      if(!playlists.length) return addPL();
      loadPL();
    };
    this.render=function(){return root};
    this.start=function(){focus(colG)};

    function addPL(){
      Lampa.Input.edit({title:'Плейлист URL',free:true},function(u){
        if(!u)return;
        playlists.push({name:'Playlist '+(playlists.length+1),url:u});
        Lampa.Storage.set('iptv_pl',playlists);
        active=playlists.length-1;
        Lampa.Storage.set('iptv_pl_a',active);
        reload();
      });
    }

    function reload(){
      Lampa.Activity.close();
      setTimeout(()=>Lampa.Activity.push({title:'IPTV',component:'iptv'}),50);
    }

    function loadPL(){
      $.ajax({
        url:playlists[active].url,
        success:parse,
        error:()=>$.ajax({
          url:KULIK+encodeURIComponent(playlists[active].url),
          success:parse
        })
      });
    }

    function parse(m3u){
      groups={'⭐ Избранное':[]}; all=[];
      var c=null;
      m3u.split('\n').forEach(l=>{
        l=l.trim();
        if(l.startsWith('#EXTINF')){
          c={
            n:(l.match(/,(.*)$/)||[])[1]||'',
            id:(l.match(/tvg-id="([^"]+)"/)||[])[1]||'',
            g:(l.match(/group-title="([^"]+)"/)||[])[1]||'ОБЩИЕ'
          };
        } else if(l.startsWith('http')&&c){
          c.u=l; all.push(c);
          if(!groups[c.g])groups[c.g]=[];
          groups[c.g].push(c);
          c=null;
        }
      });
      groups['⭐ Избранное']=all.filter(x=>fav.includes(x.n));
      loadEPG(renderGroups);
    }

    function renderGroups(){
      colG.empty();
      Object.keys(groups).forEach(g=>{
        $('<div class="selector item">'+g+'</div>')
        .on('hover:enter',()=>renderCh(groups[g]))
        .appendTo(colG);
      });
      focus(colG);
    }

    function renderCh(list){
      colC.empty();
      list.forEach(ch=>{
        var r=$(`
          <div class="selector item chan">
            <div class="logo"><img></div>
            <div><div class="name">${ch.n}</div><div class="sub">OK ▶</div></div>
          </div>`);

        if(ch.id&&epgIcons[ch.id]) r.find('img').attr('src',epgIcons[ch.id]);
        else r.find('img').attr('src','https://bylampa.github.io/img/iptv.png');

        r.on('hover:focus',()=>updateEPG(ch));
        r.on('hover:enter',()=>Lampa.Player.play({url:ch.u,title:ch.n,type:'tv',epg:EPG_URL,epg_id:ch.id}));
        colC.append(r);
      });
      focus(colC);
    }

    function updateEPG(ch){
      colE.empty();
      $('<div class="et">'+ch.n+'</div>').appendTo(colE);
      var p=getNow(ch.id);
      $('<div class="er">'+(p?'Сейчас: '+p.t:'Нет программы')+'</div>').appendTo(colE);
    }
  }

  function init(){
    Lampa.Component.add('iptv',IPTV);
    $('.menu .menu__list').append(
      $('<li class="menu__item selector"><div class="menu__text">IPTV</div></li>')
      .on('hover:enter',()=>Lampa.Activity.push({title:'IPTV',component:'iptv'}))
    );
  }

  if(window.app_ready) init();
  else Lampa.Listener.follow('app',e=>e.type==='ready'&&init());
})();
