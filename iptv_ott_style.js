// ==Lampa==
// name: IPTV OTT
// version: 1.0.0
// description: IPTV plugin (OttPlayer style)
// author: Artrax90
// ==/Lampa==

(function () {
    'use strict';

    if (!window.Lampa) return;

    Lampa.Extensions.add({
        name: 'iptv_ott',
        version: '1.0.0',
        description: 'IPTV plugin (OttPlayer style)',

        init: function () {
            console.log('[IPTV OTT] extension loaded');

            const STORAGE_KEY = 'iptv_ott_cfg';

            let cfg = Lampa.Storage.get(STORAGE_KEY, {
                playlist: '',
                epg: ''
            });

            function save() {
                Lampa.Storage.set(STORAGE_KEY, cfg);
            }

            /* ================= SETTINGS ================= */

            Lampa.Settings.add({
                title: 'IPTV (Ott style)',
                component: 'iptv_ott_settings'
            });

            Lampa.Component.add('iptv_ott_settings', {
                template: `
                    <div class="settings">
                        <div class="settings__item selector" data-type="playlist">
                            URL плейлиста (M3U)
                            <div class="settings__value">${cfg.playlist || 'не задан'}</div>
                        </div>
                        <div class="settings__item selector" data-type="epg">
                            URL EPG (xmltv)
                            <div class="settings__value">${cfg.epg || 'не задан'}</div>
                        </div>
                    </div>
                `,
                start: function () {
                    this.render().find('.settings__item').on('click', function () {
                        let type = this.dataset.type;

                        Lampa.Input.edit({
                            title: type === 'playlist' ? 'URL M3U плейлиста' : 'URL EPG (xmltv)',
                            value: cfg[type],
                            onBack: function (val) {
                                cfg[type] = val;
                                save();
                            }
                        });
                    });

                    Lampa.Controller.enable('content');
                }
            });

            /* ================= ENTRY ================= */

            Lampa.Settings.add({
                title: 'IPTV (просмотр)',
                onClick: function () {
                    if (!cfg.playlist) {
                        Lampa.Noty.show('Укажи URL плейлиста');
                        return;
                    }

                    Lampa.Request.get(cfg.playlist, parseM3U);
                }
            });

            /* ================= M3U ================= */

            function parseM3U(text) {
                let lines = text.split('\n');
                let channels = [];
                let current = null;

                lines.forEach(function (line) {
                    line = line.trim();

                    if (line.startsWith('#EXTINF')) {
                        current = {
                            title: line.split(',').pop(),
                            group: (line.match(/group-title="(.*?)"/) || [,'Без группы'])[1],
                            logo: (line.match(/tvg-logo="(.*?)"/) || [,''])[1],
                            epg:  (line.match(/tvg-id="(.*?)"/) || [,''])[1],
                            url: ''
                        };
                    }
                    else if (line && !line.startsWith('#') && current) {
                        current.url = line;
                        channels.push(current);
                        current = null;
                    }
                });

                openIPTV(channels);
            }

            /* ================= UI ================= */

            function openIPTV(channels) {
                Lampa.Activity.push({
                    component: 'iptv_ott',
                    title: 'IPTV',
                    data: channels
                });
            }

            Lampa.Component.add('iptv_ott', {
                template: `
                    <div class="iptv-ott">
                        <div class="iptv-groups"></div>
                        <div class="iptv-channels"></div>
                    </div>
                `,
                start: function () {
                    let root = this.render();
                    let groupsBox = root.find('.iptv-groups');
                    let channelsBox = root.find('.iptv-channels');

                    let groups = {};

                    this.params.data.forEach(function (ch) {
                        if (!groups[ch.group]) groups[ch.group] = [];
                        groups[ch.group].push(ch);
                    });

                    Object.keys(groups).forEach(function (group) {
                        let g = $('<div class="selector iptv-group"></div>');
                        g.text(group);
                        g.on('click', function () {
                            renderChannels(groups[group]);
                        });
                        groupsBox.append(g);
                    });

                    function renderChannels(list) {
                        channelsBox.empty();

                        list.forEach(function (ch) {
                            let item = $(`
                                <div class="selector iptv-channel">
                                    <img src="${ch.logo || ''}">
                                    <span>${ch.title}</span>
                                </div>
                            `);

                            item.on('click', function () {
                                Lampa.Player.play({
                                    title: ch.title,
                                    url: ch.url,
                                    type: 'tv',
                                    epg: cfg.epg || null,
                                    epg_id: ch.epg || null
                                });
                            });

                            channelsBox.append(item);
                        });
                    }

                    let firstGroup = Object.keys(groups)[0];
                    if (firstGroup) renderChannels(groups[firstGroup]);

                    Lampa.Controller.enable('content');
                }
            });
        }
    });

})();
