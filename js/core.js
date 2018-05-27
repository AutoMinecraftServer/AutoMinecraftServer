/* eslint-disable */
/* global $ */
/* global process */
var slash;
if (process.platform === 'win32')
    slash = '\\';
else
    slash = '/';
var dpi = $('#dpi').outerHeight();
//$('#dpi').remove();
$('body').css('zoom', dpi / 72 * 100 + '%');

var load_end_count = 0;
var profiles = {};
//プロファイル
var settings = { 'log_att': true, 'backup_notify': false, 'backup_dir_bool': false, 'backup_dir': '' };
//設定
var logs = {};
//DataTableオブジェクト
var servers = {};
//サーバーリスト
var players = {};
//プレイヤーリスト
var timers = {};
//タイマー
var nopeoples = {};
//無人タイマー
var timer_count = {};
//タイマーカウント
var nopeople_count = {};
//無人タイマーカウント
var indices = {};
//予測変換
var port = {};
//ポート情報
var backup_flag = {};
//バックアップのログ削除フラグ
var restart_flag = {};
//再起動フラグ
var profile_close = false;
var base_dir = '';

function resize(){ $(window).trigger('resize'); }

function ver(e){
    $('#version').html($(e).text() + ' <span class="caret"></span>');
}

var electron = require('electron');
var shell = electron.shell;
var remote = electron.remote;
var ipc = electron.ipcRenderer;
var dialog = remote.dialog;
var browserWindow = remote.BrowserWindow;
var app = remote.app;
var exec = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var del = require('del');
var encoding = require('encoding-japanese');
var upnp = require('nat-upnp').createClient();
var request = require('request');
var Server = require('./Server')

//右クリックメニュー
$(document).on('contextmenu', function(e){
    var text = window.getSelection().toString();
    var b = (text !== '')? true : false;
    var text_ = (text.length > 15)? '...' : '';
    if ($(e.target).get(0).tagName === 'INPUT'){
        if ($(e.target).prop('disabled') === true) return;
        remote.Menu.buildFromTemplate([
            {label: '切り取り', accelerator: 'CmdOrCtrl+X', role: 'cut', enabled: b},
            {label: 'コピー', accelerator: 'CmdOrCtrl+C', role: 'copy', enabled: b},
            {label: '貼り付け', accelerator: 'CmdOrCtrl+V', role: 'paste'},
            {label: 'すべて選択', accelerator: 'CmdOrCtrl+A', role: 'selectall'},
            {type: 'separator'},
            {label: '「' + text.slice(0, 15) + text_ + '」を検索', enabled: b, click: function(){
                window.open('http://google.co.jp/search?q=' + encodeURIComponent(text))
            }},
            {type: 'separator'},
            {label: '取消', accelerator: 'CmdOrCtrl+Z', role: 'undo'},
            {label: 'やり直し', accelerator: 'CmdOrCtrl+Y', role: 'redo'}
        ]).popup(remote.getCurrentWindow());
    } else if ($(e.target).parent().get(0).className === 'player'){
        var name = $(e.target).text();
        var id = $(e.target).attr('class').slice(0, $(e.target).attr('class').indexOf('_'));
        $('#copy_player').remove();
        $('body').append('<button id="copy_player" data-clipboard-text="' + name + '" style="display:none;"></button>');
        new Clipboard('#copy_player');
        remote.Menu.buildFromTemplate([
            {label: '名前をコピー', click: function(){ $('#copy_player').trigger('click'); }},
            {type: 'separator'},
            {label: '「' + name + '」をBAN', click: function(){ send_command(id, 'ban ' + name); }},
            {label: '「' + name + '」のIPをBAN', click: function(){ send_command(id, 'ban-ip ' + name); }},
            {label: '「' + name + '」にOP権限を与える', click: function(){ send_command(id, 'op ' + name); }},
            {label: '「' + name + '」にOP権限を剥奪', click: function(){ send_command(id, 'deop ' + name); }},
            {type: 'separator'},
            {label: '「' + name + '」を退出させる', click: function(){ send_command(id, 'kick ' + name); }},
            {label: '「' + name + '」をキル', click: function(){ send_command(id, 'kill ' + name); }},
            {label: '「' + name + '」のアイテムを削除', click: function(){ send_command(id, 'clear ' + name); }}
        ]).popup(remote.getCurrentWindow());
    } else if (b)
        remote.Menu.buildFromTemplate([
            {label: 'コピー', accelerator: 'CmdOrCtrl+C', role: 'copy', visible: b},
            {label: '「' + text.slice(0, 15) + text_ + '」を検索', enabled: b, click: function(){
                window.open('http://google.co.jp/search?q=' + encodeURIComponent(text))
            }}
        ]).popup(remote.getCurrentWindow());
});
//作業ディレクトリ
if (process.platform === 'win32') base_dir = path.dirname(fs.realpathSync('./')) + slash;
else base_dir = path.dirname(fs.realpathSync('')) + slash;
//ウィンドウ設定
$('#report_modal, #manage_modal, #profile_modal, #settings_modal, #port_modal').draggable({handle: '.modal-header'});
$('#report_modal, #manage_modal, #profile_modal').resizable();
//バージョン表示
$('.update').text('バージョン:' + app.getVersion());
//初期設定
$.fn.bootstrapSwitch.defaults.size = 'mini';
$.fn.bootstrapSwitch.defaults.onText = '有効';
$.fn.bootstrapSwitch.defaults.offText = '無効';
$.fn.bootstrapSwitch.defaults.handleWidth = 50;
$('[name="toggle"]').bootstrapSwitch();
//リサイズイベント
$(window).on('resize', function(){
    var h = ($(window).height() / (dpi / 72))// - 20;
    $('#main').height(h + 'px');
    $.each(profiles, function(i, e){ $('#' + e.id + '_content').find('.dataTables_scrollBody').height(h - 265 + 'px'); });
    if ($(window).width() > 1380 && $('#menu').data('show')) menu();
});
//$.fn.dataTable.moment('YYYY/MM//DD HH:mm:ss.SSS');
//最新情報読み込み
var org = 'https://raw.githubusercontent.com/AutoMinecraftServer/AutoMinecraftServer/';
$.ajax({ url: org + 'master/parts/info.html', type: 'GET',
    success: function(data){ $('.info').html(data); }, error: function(xhr, status, err){} });
//Minecraftバージョン情報取得
$.ajax({ url: org + 'master/parts/versions.html', type: 'GET',
    success: function(data){ $('#version_body').html(data); }, error: function(xhr, status, err){} });

//プロファイル、設定ファイル読み込み
fs.readFile(base_dir + 'profile.ams', 'utf8', function(e, t){
    if (e){
        load_end(true);
        return;
    }
    profiles = JSON.parse(t);
    if (Object.keys(profiles).length === 0){
        load_end(true);
        return;
    }
    $.each(profiles, function(i, p){
        profile_ready(p.id);
    });
    //reload_profile();
    create_detail(null);
});
fs.readFile(base_dir + 'settings.ams', 'utf8', function(e, t){
    if (!e){
        var s = JSON.parse(t);
        for (var name in s) settings[name] = s[name];
    }
    ipc.send('settings', settings);
});
//アップデート確認
ipc.on('update', function(e, a){
    var set = (msg, title) => $('.update').append($('<span>').text(msg).attr('title', title));
    if (a === 'update-not-available') set('[最新]', '');
    if (a === 'update-available') set('[アップデートあり]', '手動で更新でしてください');
    if (a === 'update-ready') set('[アップデート準備完了]', '次回起動時に更新されます');
    if (a === 'update-check-error') set('[アップデートチェックエラー]', 'GitHubに接続できません');
    if (a === 'update-auto-error') set('[自動アップデートエラー]', '手動で更新でしてください');
});
//プロファイル設定画面
$('#profile_modal').on('show.bs.modal', function(event){
    var a = profiles[$(event.relatedTarget).parent().data('id')];
    if (a === undefined){
        a = { id: uuid(), name: '', folder: '', jar: '', max_memory: '1024', min_memory: '512', upnp: true, backup: true,
            backup_minute: '10', backup_count: '5' };
        $('#folder_input, #jar_input').attr('placeholder', '空欄でも可');
        $('#change_check').parent().parent().hide();
        $('#version').parent().parent().show();
        if ($(this).data('zip') !== undefined && $(this).data('zip') !== ''){
            $(this).data('zip_bool', true);
            $('#zip_explain').show();
            $('#jar_input, #jar_select').prop('disabled', true);
            if ($(this).data('type') === 'world') $('#jar_input').attr('placeholder', 'ダウンロードのみ');
            else if ($(this).data('type') === 'all') $('#jar_input').attr('placeholder', 'Zipから読み込み/ダウンロードのみ');
        }
    }
    else {
        $('#change_check').parent().parent().show();
        $('#version').parent().parent().hide();
        $('#folder_input, #jar_input').attr('placeholder', '');
    }
    $('#version').removeClass('btn-danger');
    $('.has-error').removeClass('has-error');
    $('#id').val(a.id);
    $('#name').val(a.name);
    $('#folder_input').val(a.folder);
    $('#jar_input').val(a.jar);
    $('#max_memory_text').val(a.max_memory + 'MB');
    $('#min_memory_text').val(a.min_memory + 'MB');
    $('#upnp_check').prop('checked', a.upnp);
    $('#backup_check').prop('checked', a.backup);
    $('#backup_minute').val(a.backup_minute);
    $('#backup_count').val(a.backup_count);
});
$('#profile_modal').on('hide.bs.modal', function(e){
    if (profile_close)
        e.preventDefault()
    $(this).data('zip', '').data('zip_bool', '').data('type', '').data('base', '').data('count', '');
    $('#zip_explain').hide();
    $('#jar_input_div').show();
    $('#jar_choice_div').hide();
    $('#jar_input, #jar_select').prop('disabled', false);
    $('#jar_choice').html('必ず選択してください<span class="caret"></span>');
    $('#jar_list').html('');

    $('#change_check').prop('checked', false);
    $('#change_check').parent().parent().hide();
    $('#version').parent().parent().hide();
    $('#progress').parent().hide();
    $('#progress_text').hide();
    $('#profile_modal_close').prop('disabled', false);
    $('#profile_modal_body *').prop('disabled', false);
    $('#profile_modal_footer').children().prop('disabled', false);
    $('#progress').width('0%');
    $('#progress_text').text('処理中...(0%)');
});
$('#profile_save').click(function(){
    var error = false;
    var p = profiles[$('#id').val()] !== undefined;
    if (p){
        //名前変更なし
        if ($('#name').val() === profiles[$('#id').val()].name)
            error = false;
        //名前なし
        else if ($('#name').val() === ''){
            $('#name').parent().addClass('has-error');
            error = true;
        }
        //名前重複
        else
            $.each(profiles, function(i, e){
                if ($('#name').val() === e.name){
                    $('#name').parent().addClass('has-error');
                    error = true;
                }
            });
        //フォルダーチェック
        if (!fs.existsSync($('#folder_input').val()) || path.extname($('#folder_input').val()) !== ''){
            $('#folder_input').parent().addClass('has-error');
            error = true;
        }
        //Jarチェック
        if (!fs.existsSync($('#jar_input').val()) || path.extname($('#jar_input').val()) !== '.jar'){
            $('#jar_input').parent().addClass('has-error');
            error = true;
        }
        if ($('#version').text() === '選択' && $('#version').parent().parent().css('display') !== 'none'){
            $('#version').addClass('btn-danger');
            error = true;
        }
    }
    else {
        //名前重複(新規)
        $.each(profiles, function(i, e){
            if ($('#name').val() === e.name){
                $('#name').parent().addClass('has-error');
                error = true;
            }
        });
        //フォルダーチェック(新規)
        if (!fs.existsSync($('#folder_input').val()) && $('#folder_input').val() !== ''){
            $('#folder_input').parent().addClass('has-error');
            error = true;
        }
        //Jarチェック(新規)
        if ($('#version').text() === '選択' && !fs.existsSync($('#jar_input').val()) && $('#jar_input').val().slice(0, 2) !== '..' && $('#jar_choice').text().trim() === '必ず選択してください'){
            if ($('#version').parent().parent().css('display') === 'none') $('#jar_input').parent().addClass('has-error');
            else $('#version').addClass('btn-danger');
            error = true;
        }
    }
    if (error) return;
    var a = {};
    a.id = $('#id').val();
    a.name = $('#name').val();
    a.folder = $('#folder_input').val();
    a.jar = $('#jar_input').val();
    a.max_memory = parseInt($('#max_memory_text').val());
    a.min_memory = parseInt($('#min_memory_text').val());
    a.upnp = $('#upnp_check').prop('checked');
    a.backup = $('#backup_check').prop('checked');
    a.backup_minute = $('#backup_minute').val();
    a.backup_count = $('#backup_count').val();
    if (!p){
        //フォルダ自動指定
        if ($('#folder_input').val() === ''){
            var name = $('#name').val().replace(/:/g, '_').replace(/;/g, '_').replace(/\\/g, '_').replace(slash, '_').replace(/\|/g, '_').replace(/,/g, '_').replace(/\*/g, '_').replace(/\?/g, '_').replace(/"/g, '_').replace(/</g, '_').replace(/>/g, '_');
            a.folder = path.dirname(fs.realpathSync('./')) + slash + name;
            try { fs.mkdirSync(a.folder); } catch(ex){}
            $('#folder_input').val(a.folder);
        }
        profiles[a.id] = a;
        fs.writeFile(base_dir + 'profile.ams', JSON.stringify(profiles), (error) => { /* handle error */ });
        if ($('#profile_modal').data('zip_bool')){
            if ($('#jar_input').val() !== ''){
                a.jar = a.jar.replace('..' + slash, $('#folder_input').val() + slash);
                $('#jar_input').val(a.jar);
                progress(a.id, undefined, { data: $('#profile_modal').data('zip'), type: $('#profile_modal').data('type'), base: $('#profile_modal').data('base'), count: $('#profile_modal').data('count') });
            }
            else if ($('#jar_choice').text().trim() !== '必ず選択してください'){
                a.jar = $('#folder_input').val() + slash + $('#jar_choice').text().trim();
                $('#jar_input_div').show();
                $('#jar_choice_div').hide();
                $('#jar_input').val(a.jar);
                progress(a.id, undefined, { data: $('#profile_modal').data('zip'), type: $('#profile_modal').data('type'), base: $('#profile_modal').data('base'), count: $('#profile_modal').data('count') });
            }
            else {
                var index = $('#version').text().indexOf(' ');
                progress(a.id, { ver: $('#version').text().slice(index + 1, -1), type: $('#version').text().slice(0, index), latest: $('#latest_check').prop('checked') }, { data: $('#profile_modal').data('zip'), type: $('#profile_modal').data('type'), base: $('#profile_modal').data('base'), count: $('#profile_modal').data('count') });
            }
        }
        else {
            if (fs.existsSync($('#jar_input').val())){
                $('#profile_modal').modal('hide');
                profile_ready(a.id, true);
                //reload_profile();
                create_detail(a.id);
            }
            else {
                var index = $('#version').text().indexOf(' ');
                progress(a.id, { ver: $('#version').text().slice(index + 1, -1), type: $('#version').text().slice(0, index), latest: $('#latest_check').prop('checked') });
            }
        }
    }
    else {
        profiles[a.id] = a;
        fs.writeFile(base_dir + 'profile.ams', JSON.stringify(profiles), (error) => { /* handle error */ });
        if ($('#change_check').prop('checked')){
                var index = $('#version').text().indexOf(' ');
                progress(a.id, { ver: $('#version').text().slice(index + 1, -1), type: $('#version').text().slice(0, index), latest: $('#latest_check').prop('checked') });
        }
        else {
            $('#profile_modal').modal('hide');
            profile_ready(a.id, true);
            create_detail(a.id);
        }
    }
});
$('#max_memory_slider').on('input', function(){
    if (parseInt($('#min_memory_slider').val()) > parseInt($(this).val())) $(this).val($('#min_memory_slider').val());
    $('#max_memory_text').val($(this).val() * 128 + 'MB');
});
$('#min_memory_slider').on('input', function(e){
    if (parseInt($('#max_memory_slider').val()) < parseInt($(this).val())) $(this).val($('#max_memory_slider').val());
    $('#min_memory_text').val($(this).val() * 128 + 'MB');
});
$('#name, #folder_input, #jar_input').keyup(function(){ $(this).parent().removeClass('has-error'); });
$('.dropdown-menu li a').click(function(){
    $(this).parents('.dropdown').find('.dropdown-toggle').html($(this).text() + ' <span class="caret"></span>');
    $(this).parents('.dropdown').find('input[name="dropdown-value"]').val($(this).attr('data-value'));
    $('#version').removeClass('btn-danger');
});
$('#jar_select').click(function(){
    var focusedWindow = browserWindow.getFocusedWindow();
    dialog.showOpenDialog(focusedWindow, {
        properties: ['openFile'],
        filters: [{ name: 'jar', extensions: ['jar'] }]
    }, function(files){
        if (files === undefined) return;
        $('#jar_input').val(files[0]).parent().removeClass('has-error');
    });
});
$('#folder_select').click(function(){
    var focusedWindow = browserWindow.getFocusedWindow();
    dialog.showOpenDialog(focusedWindow, {
        properties: ['openDirectory']
    }, function(directories){
        if (directories === undefined) return;
        $('#folder_input').val(directories[0]).parent().removeClass('has-error');
        if ($('#name').val() === '') $('#name').val(path.basename(directories[0])).parent().removeClass('has-error');
    });
});
$('#change_check')
//properties画面
$('#manage_modal').on('show.bs.modal', function(event){
    var a = profiles[$(event.relatedTarget).parent().data('id')];
    ipc.send('load_manage', a);
    $('#manage_title').text('サーバー/ログ/コマンド履歴/バックアップの管理 - ' + a.name + ' -');
    var data = '<tr><th>全ての履歴</th><th><button type="button" class="btn btn-danger command_del" data-text="">削除</button></th></tr>';
    $.each(indices[a.id], function(i, e_){
        data += '<tr><th>' + e_ + '</th><th><button type="button" class="btn btn-danger command_del" data-text="' + e_ + '">削除</button></th></tr>';
    });
    $('#command_content').html('<table class="table table-hover table-condensed manage_table"><thead><tr><th data-sortable="false">コマンド</th><th data-sortable="false">操作</th></tr></thead><tbody>' + data + '</tbody></table>');
    $('.command_del').click(function(event){
        var text = $(this).data('text');
        function check(t){
            if (text === '') return 'すべての履歴を消しますか？';
            else return '[' + text + ']を履歴から削除しますか？';
        }
        dialog.showMessageBox(browserWindow.getFocusedWindow(), {
            title: 'コマンド履歴削除', type: 'warning', message: check(text), buttons: ['削除', 'キャンセル'], cancelId: -1, defaultId: 1 },
            function(b){
                if (b !== 0) return;
                if (text === '' && b === 0){
                    indices[a.id] = ['achievement', 'ban', 'ban-ip', 'banlist', 'blockdata', 'clear', 'clone', 'debug', 'defaultgamemode', 'deop', 'difficulty', 'effect', 'enchant', 'entitydata', 'execute', 'fill', 'gamemode', 'gamerule', 'give', 'help', 'kick', 'kill', 'list', 'me', 'op', 'pardon', 'pardon-ip', 'particle', 'playsound', 'replaceitem', 'save-all', 'save-off', 'save-on', 'say', 'scoreboard', 'seed', 'setblock', 'setidletimeout', 'setworldspawn', 'spawnpoint', 'spreadplayers', 'stats', 'stop', 'tell', 'tellraw', 'testfor', 'testforblock', 'testforblocks', 'time', 'title', 'toggledownfall', 'tp', 'trigger', 'weather', 'whitelist', 'worldborader', 'xp'];
                    var data = '<tr><th>すべての履歴</th><th><button type="button" class="btn btn-danger command_del" data-text="">削除</button></th></tr>';
                    $.each(indices[a.id], function(i, e_){
                        data += '<tr><th>' + e_ + '</th><th><button type="button" class="btn btn-danger command_del" data-text="' + e_ + '">削除</button></th></tr>';
                    });
                    $('#command_content').html('<table class="table table-hover table-condensed manage_table"><thead><tr><th data-sortable="false">コマンド</th><th data-sortable="false">操作</th></tr></thead><tbody>' + data + '</tbody></table>');
                }
                else if (b === 0){
                    indices[a.id].splice(indices[a.id].indexOf(text), 1);
                    $(this).parent().parent().remove();
                }
            save_indices(a.id);
        });
    });
});
$('.properties_toggle').on('switchChange.bootstrapSwitch', function(event, state){
    properties[$(this).attr('id')] = state;
    ipc.send('save_properties', { location: properties_location, data: properties });
});
$('.properties_text').change(function(event){
    properties[$(this).attr('id')] = $(this).val();
    ipc.send('save_properties', { location: properties_location, data: properties });
});
$('.properties_drop').click(function(event){
    var a = $(this).parent().find('.dropdown-toggle');
    var text = a.text().trim();
    switch (a.attr('id')){
        case 'difficulty': properties[a.attr('id')] = ({'ピースフル':'0', 'イージー':'1', 'ノーマル':'2', 'ハード':'3'})[text]; break;
        case 'gamemode': properties[a.attr('id')] = ({'サバイバル':'0', 'クリエイティブ':'1', 'アドベンチャー':'2', 'スペクテイター':'3'})[text]; break;
        case 'level-type': properties[a.attr('id')] = ({'通常':'DEFAULT', 'フラット':'FLAT', '大きなバイオーム':'LARGEBIOMES', 'アンプリファイド':'AMPLIFIED', 'カスタマイズ':'CUSTOMIZED'})[text]; break;
    }
    ipc.send('save_properties', { location: properties_location, data: properties });
});
var properties, properties_location;
ipc.on('load_properties', function(e, data){
    if (data === undefined || data === null) return;
    properties_location = data.location;
    properties = data.data;
    for (var key in properties)
    {
        var val = properties[key];
        switch (key){
            case 'difficulty':
                $('#difficulty').html((['ピースフル', 'イージー', 'ノーマル', 'ハード'])[val] + ' <span class="caret"></span>');
                break;
            case 'gamemode':
                $('#gamemode').html((['サバイバル', 'クリエイティブ', 'アドベンチャー', 'スペクテイター'])[val] + ' <span class="caret"></span>');
                break;
            case 'level-type':
                $('#level-type').html(({'DEFAULT': '通常', 'FLAT': 'フラット', 'LARGEBIOMES': '大きなバイオーム', 'AMPLIFIED': 'アンプリファイド', 'CUSTOMIZED': 'カスタマイズ'})[val] + ' <span class="caret"></span>');
                break;
            default:
                if ($('#' + key).attr('name') === 'toggle'){
                    if (val === 'true') $('#' + key).bootstrapSwitch('state', true);
                    else if (val === 'false') $('#' + key).bootstrapSwitch('state', false);
                } else $('#' + key).val(val);
        }
    }
    resize();
});
ipc.on('load_logs', function(e, data){
    var html = '';
    if (data === undefined || data === null){
        $('#log_content').html('<h3>ログファイルはありません</h3>');
        return;
    }
    else if (data.length <= 1){
        $('#log_content').html('<h3>ログファイルはありません</h3>');
        return;
    }
    $.each(data, function(i, e_){
        if (i === 0) html += '<tr><th>すべてのファイル</th><th><button type="button" class="btn btn-danger log_del" data-file="' + e_ + '">削除</button></th></tr>'
        else html += '<tr><th>' + e_.slice(e_.lastIndexOf(slash) + slash.length) + '</th><th><button type="button" class="btn btn-danger log_del" data-file="' + e_ + '">削除</button></th></tr>';
    });
    $('#log_content').html('<table class="table table-hover table-condensed manage_table"><thead><tr><th data-sortable="false">ファイル</th><th data-sortable="false">操作</th></tr></thead><tbody>' + html + '</tbody></table>');
    resize();
    $('.log_del').click(function(event){
        var dir = $(this).data('file');
        if (dir.slice(-4) === 'logs'){
            del([dir + slash + '**', '!' + dir], { force: true });
            $('#log_content').html('<h3>ログファイルはありません</h3>');
        } else {
            del(dir, { force: true });
            $(this).parent().parent().remove();
        }
    });
});
ipc.on('load_backup', function(e, data){
    var html = '';
    if (data === undefined || data === null){
        $('#backup_content').html('<h3>バックアップはありません</h3>');
        return;
    }
    else if (data.length <= 1){
        $('#backup_content').html('<h3>バックアップはありません</h3>');
        return;
    }
    $.each(data.data, function(i, e_){
        if (i === 0) html = '<tr><th><a onclick="shell.openItem(\'' + tohtml(e_) + '\');">全てのバックアップ</a></th><th></th><th><button type="button" class="btn btn-danger backup_del" data-folder="' + e_ + '">削除</button></th></tr>';
        else {
            var date = e_.slice(e_.lastIndexOf(slash) + slash.length);
            html += '<tr><th><a onclick="shell.openItem(\'' + tohtml(e_) + '\');">' + date + '</a></th><th><button type="button" class="btn btn-primary backup_restore" data-folder="' + e_ + '" data-id="' + data.id + '">復元</button></th><th><button type="button" class="btn btn-danger backup_del" data-folder="' + e_ + '">削除</button></th></tr>';
        }
    });
    $('#backup_content').html('<table class="table table-hover table-condensed manage_table"><thead><tr><th data-sortable="false">日付</th><th data-sortable="false">操作</th><th></th></tr></thead><tbody>' + html + '</tbody></table>');
    resize();
    $('.backup_del').click(function(event){
        var dir = $(this).data('folder');
        dialog.showMessageBox(browserWindow.getFocusedWindow(), {
            title: 'バックアップ削除', type: 'warning', message: dir.slice(dir.lastIndexOf(slash) + slash.length) + 'のバックアップを削除しますか？',
            detail: 'バックアップは削除したら復元できません\n(既存のワールドデータに影響はありません)', buttons: ['削除', 'キャンセル'], cancelId: -1,
            defaultId: 1 },
            function(b){
                if (b !== 0) return;
                del(dir, { force: true });
                if (dir.slice(-6) === 'backup') $('#log_content').html('<h3>バックアップはありません</h3>');
                else $(this).parent().parent().remove();
            }
        );
    });
    $('.backup_restore').click(function(event){
        var dir = $(this).data('folder');
        var id = $(this).data('id');
        dialog.showMessageBox(browserWindow.getFocusedWindow(), {
            title: 'ワールド復元', type: 'warning',
            message: dir.slice(dir.lastIndexOf(slash) + slash.length) + '時点のデータを復元しますか？',
            detail: 'バックアップされたデータで上書きされます\n(現在のワールドデータはバックアップされます。)',
            buttons: ['復元', 'キャンセル'], cancelId: -1, defaultId: 1 },
            function(b){
                if (b !== 0) return;
                ipc.send('restore', { backup: dir, profile: profiles[id] });
        });
    });
});
ipc.on('restore_success', function(){ dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: '復元完了', type: 'info', message: '復元が完了しました', detail: '起動ボタンでサーバーを立ち上げてください', buttons: ['OK'] }); });
//設定画面
$('#settings_modal').on('show.bs.modal', function(){
    for (var name in settings){
        if (typeof settings[name] === 'boolean') $('#' + name).prop('checked', settings[name]).change() ;
        else $('#' + name).val(settings[name]);
    }
});
$('#settings_save').click(function(){
    if ($('#backup_dir_bool').prop('checked') && !fs.existsSync($('#backup_dir').val())){
        $('#backup_dir').parent().addClass('has-error');
        dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: 'エラー', type: 'warning', message: 'バックアップ先のディレクトリが正しくありません', buttons: ['OK'] });
        return;
    }
    var bd_bak = settings.backup_dir_bool;
    var s = $('.settings');
    $.each(s, function(a,b){
        if ($(b).attr('type') === 'checkbox') settings[$(b).attr('id')] = $(b).prop('checked');
        else settings[$(b).attr('id')] = $(b).val();
        if (s.length === a + 1){
            ipc.send('settings', settings);
            $('#settings_modal').modal('hide');
            fs.writeFile(base_dir + 'settings.ams', JSON.stringify(settings), (error) => { /* handle error */ });
            if (bd_bak !== settings.backup_dir_bool){
                $('#loading_text').text('バックアップデータを移動中...');
                $('#loading').show();
                ipc.send('backup_move', { p: profiles, mode: settings.backup_dir_bool });
            }
        }
    });
});
$('#backup_select').click(function(){
    var focusedWindow = browserWindow.getFocusedWindow();
    dialog.showOpenDialog(focusedWindow, {
        properties: ['openDirectory']
    }, function(directories){
        if (directories === undefined) return;
        $('#backup_dir').val(directories[0]).parent().removeClass('has-error');
    });
});
ipc.on('backup_move_finish', function(){
    $('#loading').hide();
    dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: '移動完了', type: 'info', message: 'バックアップデータの移動が完了しました', detail: '問題があった場合は報告してください。', buttons: ['OK'] });
});
/*$('#remove_profile').click(function(){
    var id = $('#remove_id').val();
    delete profiles[id];
    fs.writeFile('profile.ams', JSON.stringify(profiles));
    $('#' + id + '_tab').parent().remove();
    $('#' + id + '_content').remove();
    //reload_profile();
    $('#remove_modal').modal('hide');
});
$('#remove_file').click(function(){
    var id = $('#remove_id').val();
    if (fs.existsSync(profiles[id].folder))
        try {
            del(profiles[id].folder, {
                force: true
            });
        } catch (ex){ alert('フォルダーを削除できませんでした\nパス:' + profiles[id].folder); }
    delete profiles[id];
    fs.writeFile('profile.ams', JSON.stringify(profiles));
    $('#' + id + '_tab').parent().remove();
    $('#' + id + '_content').remove();
    //reload_profile();
    $('#remove_modal').modal('hide');
});*/
$('#eula_modal').on('show.bs.modal', function(e){
    $.ajax({
        url: 'https://account.mojang.com/documents/minecraft_eula',
        type: 'GET',
        success: function(data){
                data = data.replace('/images', 'https://account.mojang.com/images');
                var s = data.indexOf('<div id="main"');
                var e = data.indexOf('<footer');
                $('#eula_div').html(data.slice(s, e - 7));
            }
        });
    //$('#eula_iframe')[0].contentDocument.location.replace('https://account.mojang.com/documents/minecraft_eula');
});
$('#eula_modal').on('hide.bs.modal', function(e){ $('#eula_agree').off('click'); });

//データ選択
$('.drag_area').bind('drop', function(e){
    e.preventDefault();
    var files = e.originalEvent.dataTransfer.files;
    var d = '';
    if (files.length === 0) return;
    else if (files[0].type === 'application/x-zip-compressed') load_zip(files[0].path);
    else {
        if (path.extname(files[0].path) === '') d = files[0].path;
        else d = path.dirname(files[0].path); //////////////
        load_data(d);
    }
}
).bind('dragenter', function(){ return false; }
).bind('dragover', function(){ return false; });
$('.drag_click_folder').click(function(){
    var focusedWindow = browserWindow.getFocusedWindow();
    dialog.showOpenDialog(focusedWindow, {
        properties: ['openDirectory']
    }, function(directories){
        if (directories === undefined) return;
        load_data(directories[0]);
    });
});
$('.drag_click_file').click(function(){
    var focusedWindow = browserWindow.getFocusedWindow();
    dialog.showOpenDialog(focusedWindow, {
        properties: ['openFile']
    }, function(files){
        if (files === undefined) return;
        else if (files[0].type === 'application/x-zip-compressed') load_zip(files[0].path);
        else load_data(path.dirname(files[0]));
    });
});

//不具合報告
$('#report_type_select').click(function(event){
    if ($('#report_type').text().trim() === '不具合報告(ポート開放)'){
        upnp.findGateway(function(a, b, c){
            var data = {};
            data.error = a;
            data.device = b;
            data.gateway = c;
            data.adapter = require('os').networkInterfaces();
            $('#port_text').text(JSON.stringify(data));
        });
        $('#port_text, #port_text_h').show();
        $('#report_text').css('height', '40%');
    } else {
        $('#port_text, #port_text_h').hide();
        $('#report_text').css('height', '70%');
    }
});
$('#report_send').click(function(){
    var data = {};
    if ($('#report_type').text().trim() === '不具合報告(ポート開放)') data = { type: 'port_report', data: $('#port_text').text(), text: $('#report_text').val(), ver: app.getVersion(), os: process.platform };
    else if ($('#report_type').text().trim() === '不具合報告') data = { type: 'report', text: $('#report_text').val(), ver: app.getVersion(), os: process.platform };
    else  data = { type: 'demand', text: $('#report_text').val(), ver: app.getVersion(), os: process.platform };
    $('#report_modal').modal('hide');
    $.ajax({
        url: 'http://ams.xperd.net/report.php', type: 'POST', data: data,
        success: () => $('#report_text').val(''),
        error: (xhr, status, err) => {
          var type = $('#report_type').text().trim().slice(0, 3)
          dialog.showMessageBox(browserWindow.getFocusedWindow(), {
              title: type + '送信失敗', type: 'warning', message: type + 'を正しく送信できませんでした',
              detail: '時間を開けて再送信するか、公式フォーラムから問い合わせてください',
          });
        },
    });
});
$('.reload').click(function(){
    dialog.showMessageBox(browserWindow.getFocusedWindow(), {
        title: 'プログラム再起動', type: 'warning', message: 'ソフトを再起動します', detail: 'サーバーは強制終了されます\n(動作がおかしくなったときにのみ使用してください)', buttons: ['再起動', 'キャンセル'], cancelId: -1, defaultId: 1 },
        function(b){
            if (b !== 0) return;
            location.reload();
    });
});
$(document).on('click', '.popover', function(evt){ evt.stopPropagation(); });
$(document).on('click', 'html', function(){ $('[data-toggle=popover]').popover('hide'); });

//メニュー
function menu(){
    var p = true;
    if (profiles !== undefined){
        if (Object.keys(profiles).length === 0) p = false;
    }
    else p = false;
    if ($(window).width() > 1380) p = true;

    if ($('#menu').data('show') && p){
        $('#menu_button').css({'background-color': '#555'});
        $('#menu_title').css('color', 'white');
        $('#menu_icon').css({'border-top': '1px solid white', 'border-right': '1px solid white','transform': 'rotate(135deg)', 'margin-top': '0'});
        $('#menu').hide();
        $('#menu').data('show', false);
    } else {
        $('#menu_button').css({'background-color': '#f5f5f5'});
        $('#menu_title').css('color', 'black');
        $('#menu_icon').css({'border-top': '1px solid black', 'border-right': '1px solid black','transform': 'rotate(315deg)', 'margin-top': '8px'});
        $('#menu').show();
        $('#menu').data('show', true);
    }
}

//サーバー起動
function start_server(id){
    players[id] = [];
    port[id] = [];
    var p = profiles[id];
    var server = servers[id] = new Server(p)
    server.on('error', err => {
      if (err === 'Not found server') {
        dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: 'サーバーを起動できません', type: 'error', message: 'ファイル/フォルダーが見つかりません', detail: 'プロファイルの設定を見直してください', buttons: ['OK'] });
        return
      }
    })
    try { logs[id].clear().draw(false); }
    catch (e){
        logs[id] = $('#' + id + '_log').DataTable({ 'info': false, 'ordering': false, 'scrollY': '10000px', 'scrollCollapse': true, 'paging': true, 'pagingType': 'numbers', 'pageLength': 300, 'lengthChange': false });
        resize();
    }
    server.start()
    server.on('stopped', stopped_server);
    server.on('line', text => add_line(id, text));
    $('#' + id + '_cmd_input').val('');
    $('#' + id + '_edit_button, #' + id + '_remove_button, #' + id + '_start_button').prop('disabled', true);
    $('#' + id + '_status_text').text('ステータス：起動中...');
    $('.' + id + '_status_color').removeClass('danger').removeClass('success').addClass('warning');
    $('#' + id + '_start_text').text('開始時刻：' + time(true));
    timer_count[id] = 0;
    timers[id] = setInterval('timer("' + id + '")', 1000);
    nopeople_count[id] = 0;
    nopeoples[id] = setInterval('nopeople_timer("' + id + '")', 1000);
    if (!fs.existsSync(dir(p))) fs.mkdirSync(dir(p));

    function dir(p){
        if (settings.backup_dir_bool) return settings.backup_dir + slash + p.id;
        else return p.folder + slash + 'backup';
    }

    function stopped_server(code){
        $('#' + id + '_status_text').text('ステータス：停止');
        $('#' + id + '_start_text').text('開始時刻：----/--/-- --:--:--');
        $('#' + id + '_cmd_input, #' + id + '_cmd_button').prop('disabled', true);
        $('#' + id + '_edit_button, #' + id + '_remove_button, #' + id + '_start_button').prop('disabled', false);
        $('.' + id + '_status_color').removeClass('warning').removeClass('success').addClass('danger');
        $('#' + id + '_players').html('');
        clearInterval(timers[id]);
        $('#' + id + '_elapsed_text').text('経過時間：--:--:--');
        clearInterval(nopeoples[id]);
        $('#' + id + '_nopeople').text('無人時間：--:--:--');
        if (profiles[id].upnp)
            upnp.portUnmapping({ public: port[id].port });
        $('#' + id + '_port_text').text('ポート：閉鎖').removeClass('text-warning').removeClass('text-success').addClass('text-danger');
        port[id] = [];
        if (restart_flag[id]) start_server(id);
        restart_flag[id] = false;
    }
}

//サーバー停止
function stop_server(id){
    $('#' + id + '_cmd_input, #' + id + '_cmd_button, #' + id + '_stop_button, #' + id + '_restart_button').prop('disabled', true);
    $('#' + id + '_status_text').text('ステータス：停止中...');
    $('.' + id + '_status_color').removeClass('success').removeClass('danger').addClass('warning');
    servers[id].stop()
}

//サーバー再起動
function restart_server(id){
    stop_server(id);
    restart_flag[id] = true;
}

//サーバーKill
function kill_server(id){
    dialog.showMessageBox(browserWindow.getFocusedWindow(), {
        title: '強制終了', type: 'warning', message: 'サーバー[' + profiles[id].name + ']を強制終了します', detail: '通常は停止ボタンをお使いください', buttons: ['OK', 'キャンセル'], cancelId: -1, defaultId: 1, noLink: true },
        function(b){
            if (b === 0) servers[id].kill()
    });
}

//コマンド送信
function send_command(id, ex){
    var cmd = $('#' + id + '_cmd_input').val();
    if (cmd === '過去ログを表示しています' || cmd === 'stop' || (cmd === '' && ex === undefined)) return;
    if (ex !== undefined) cmd = ex;
    servers[id].sendCommand(cmd)
    save_indices(id, cmd);
    $('#' + id + '_cmd_input').val('');
}

//ログの処理
function add_line(id, text){
    logs[id].draw(false).page('last');
    $('#' + id + '_log').parent().scrollTop(999999999999999);
    var e__ = '';
    var e_ = encoding.convert(text, 'UTF-8', 'SJIS');
    for (var i = 0, len = e_.length; i < len; i++){
        if (e_[i] < 0) e_[i] = e_[i] * -1;
        if (e_[i] < 16) e__ += '%0' + e_[i].toString(16);
        else e__ += '%' + e_[i].toString(16);
    }
    var e = decodeURIComponent(e__);
    var index = e.indexOf(':', 10);
    if (backup_flag[id]){
        if (e.substr(index + 2) === 'Saved the world'){
            ipc.send('backup', profiles[id]);
            backup_flag[id] = false;
            if (settings.backup_notify) logs[id].row.add([time(), '情報', 'バックアップが行われました']);
            return
        }
        else if (e.substr(index + 2) === 'Saving...') return;
    }
    var index_ = e.substr(index - 5, 4);
    if (e.startsWith('[')){
        var data = e.substr(index + 2);
        if (data === '') return;
        else if (!settings.log_att && data.startsWith('[@:')) return;
        else if (data.substr(0, 1) === '<') logs[id].row.add([time(), '会話', data.replace('<', '&lt;').replace('>', '&gt;')]);
        else
            switch (index_){
                case 'INFO': logs[id].row.add([time(), '情報', data]); break;
                case 'WARN': logs[id].row.add([time(), '警告', data]); break;
                case 'RROR': logs[id].row.add([time(), 'ｴﾗｰ', data]); break;
                case 'ATAL': logs[id].row.add([time(), '致命的なエラー', data]); break;
                case '[FML': logs[id].row.add([time(), 'FML', data]); break;
                case 'orge': logs[id].row.add([time(), 'Forge', data]); break;
                case 'pper': logs[id].row.add([time(), 'LW', data]); break;
                default: logs[id].row.add([time(), e.substr(index - 5, 4), data]); break;
            }
    } else
        logs[id].row.add([time(), 'ｴﾗｰ', e]);
    if ($('#' + id + '_status_text').text() !== 'ステータス：稼働中')
        if (e.includes('Done')){
            $('#' + id + '_status_text').text('ステータス：稼働中');
            $('#' + id + '_cmd_input').prop('disabled', false);
            $('#' + id + '_cmd_button').prop('disabled', false);
            $('#' + id + '_stop_button').prop('disabled', false);
            $('#' + id + '_restart_button').prop('disabled', false);
            $('.' + id + '_status_color').removeClass('warning').removeClass('danger').addClass('success');
            backup(id);
        }
        else if (e.includes('You need to agree to the EULA in order to run the server. Go to eula.txt for more info.')){
            $('#eula_agree').click(function(){
                $('#eula_modal').modal('hide');
                servers[id].agreeEula()
                $(this).off('click');
            });
            $('#eula_modal').modal('show');
        }
        else if (e.includes('Starting Minecraft server on')){
            if (profiles[id].upnp) port_open(id, parseInt(e.substr(e.indexOf(':', index + 1) + 1)))
        }
    if (e.includes('logged')){
        clearInterval(nopeoples[id]);
        $('#' + id + '_nopeople').text('無人時間：--:--:--');
        var name = e.slice(index + 2, e.indexOf('[', index));
        getAvatarURL(name, url => {
            $('#' + id + '_players').append('<span class="player" id="' + id + '_' + name + '"><img src="' + url + '"><mark>' + name + '</mark><span>');
        });
        players[id].push(name);
    }
    else if (e.includes('lost connection')){
        var index_ = e.indexOf('lost connection', index);
        $('#' + id + '_' + e.slice(index + 2, index_ - 1)).remove();
        players[id].splice(players[id].indexOf(e.slice(index + 2, index_ - 1)), 1);
        if ($('#' + id + '_players').text() === ''){
            nopeople_count[id] = 0;
            nopeoples[id] = setInterval('nopeople_timer("' + id + '")', 1000);
        }
    }
}

//ポート開放
function port_open(id, port_num){
    upnp.findGateway(function(gateway_error, info, gateway_ip){
        if (gateway_error !== null){
            if (id !== undefined){
                port[id].status = false;
                $('#' + id + '_port_text').text('ポート：失敗').removeClass('text-warning').removeClass('text-success').addClass('text-danger');
            }
            if (gateway_error.message === 'timeout') gateway_error.message = '要求がタイムアウトしました';
            dialog.showMessageBox(browserWindow.getFocusedWindow(), {
                title: 'ポート開放失敗', type: 'error', message: 'ポート開放のためのルーターが見つかりませんでした。', detail: '技術情報:' + gateway_error.message, buttons: ['OK']
            });
            return;
        }
        if (id !== undefined) port[id].gateway_ip = gateway_ip;
        var local_ip = [];
        var interfaces = require('os').networkInterfaces();
        for (var dev in interfaces)
            interfaces[dev].forEach(function(details){ if (!details.internal) if (details.family === 'IPv4') local_ip.push(details.address); });
        var main_local_ip = '';
        local_ip.forEach(function(local_ip_){
            if (gateway_ip.slice(0, gateway_ip.lastIndexOf('.')) === local_ip_.slice(0, local_ip_.lastIndexOf('.'))) main_local_ip = local_ip_;
        });
        if (id !== undefined) port[id].local_ip = main_local_ip;
        upnp.portMapping({ public: port_num, private: { port: port_num, host: main_local_ip }, description: 'Auto Minecraft Server (' + main_local_ip + ':' + port_num + ')', ttl: 0
        }, function(mapping_error, i){
            if (mapping_error === null && id !== undefined){
                port[id].status = true;
                upnp.externalIp(function(global_error, global_ip){
                    port[id].global_ip = global_ip;
                    $('#' + id + '_port_text').text('ポート：開放(' + global_ip + ':' + port_num + ')').removeClass('text-warning').removeClass('text-danger').addClass('text-success');
                });
                port_check(id, port_num);
            }
            else if (mapping_error !== null){
                if (id !== undefined){
                    port[id].status = false;
                    $('#' + id + '_port_text').text('ポート：失敗').removeClass('text-warning').removeClass('text-success').addClass('text-danger');
                }
                dialog.showMessageBox(browserWindow.getFocusedWindow(), {
                    title: 'ポート開放失敗', type: 'error', message: 'ポート開放できませんでした。',
                    detail: '技術情報:' + mapping_error.message, buttons: ['OK']
                });
            }
        });
    });
    if (id === undefined) return;
    $('#' + id + '_port_text').text('ポート：開放中...').removeClass('text-success').removeClass('text-danger').addClass('text-warning');
    port[id].port = port_num;
}

//解放チェック
function port_check(id, port_num){
    var after = function(bool){
        if (id !== undefined){
            if (bool){
                port[id].check = '<span class="bg-success text-muted" style="padding: 0 4px;">成功</span>';
                $('#' + id + 'port_check').text('正常');
            }
            else {
                port[id].check = '<span class="bg-danger text-muted" style="padding: 0 4px;">失敗</span>';
                $('#' + id + 'port_check').text('異常');
            }
        }
        else {
            $('#port_check_manual').text('外部疎通チェック').prop('disabled', false);;
            if (bool){
                dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: 'ポート開放確認成功', type: 'info', message: 'ポート:' + port_num + 'は解放されていました', buttons: ['OK'] });
            }
            else {
                dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: 'ポート開放確認失敗', type: 'error', message: 'ポート:' + port_num + 'は解放されていませんでした', buttons: ['OK'] });
            }
        }
    }

    if (id === undefined) $('#port_check_manual').text('お待ちください...').prop('disabled', true);;
    $.ajax({
        url: 'http://ams.xperd.net/port_check.php?port=' + port_num
    }).done(function(data){
        //ajaxの通信に成功した場合
        after(true);
    }).fail(function(data){
        //ajaxの通信に失敗した場合
        after(false);
    });
}

//稼働時間管理
function timer(id){
    var hms = '';
    timer_count[id] += 1;
    var h = timer_count[id] / 3600 | 0;
    var m = timer_count[id] % 3600 / 60 | 0;
    var s = timer_count[id] % 60;
    if (h !== 0)
        hms = padZero(h) + ':' + padZero(m) + ':' + padZero(s);
    else if (m !== 0)
        hms = '00:' + padZero(m) + ':' + padZero(s);
    else
        hms = '00:00:' + padZero(s);
    $('#' + id + '_elapsed_text').text('経過時間：' + hms);
    if ((timer_count[id] / 60 / profiles[id].backup_minute).toString().indexOf('.') === -1 && profiles[id].backup === true){
        backup_flag[id] = true;
        send_command(id, 'save-all');
    }
}

//無人時間管理
function nopeople_timer(id){
    var hms = '';
    nopeople_count[id] += 1;
    var h = nopeople_count[id] / 3600 | 0;
    var m = nopeople_count[id] % 3600 / 60 | 0;
    var s = nopeople_count[id] % 60;
    if (h !== 0)
        hms = padZero(h) + ':' + padZero(m) + ':' + padZero(s);
    else if (m !== 0)
        hms = '00:' + padZero(m) + ':' + padZero(s);
    else
        hms = '00:00:' + padZero(s);
    $('#' + id + '_nopeople').text('無人時間：' + hms);
}

//フォルダ読み込み
function load_data(directory){
    fs.readdir(directory, function(err, folders){
        var d_ = '';
        var world = 0;
        var all = 0;
        for (var num in folders){
            var name = folders[num];
            if (name === 'level.dat' || name === 'level.dat_old' || name === 'session.lock' || name === 'DIM1' || name === 'DIM-1' || name === 'playerdata' || name === 'region' || name === 'stats') world++;
            else if (name === 'server.properties' || name === 'whitelist.json' || name === 'usercache.json' || name === 'ops.json' || name === 'banned-players.json' || name === 'banned-ips.json' || name.indexOf('.jar') > 0) all++;
        }
        if ((world === 0 && all === 0) || world === all){
            dialog.showMessageBox(browserWindow.getFocusedWindow(), { title: 'エラー', type: 'error', message: '非対応ファイルです', detail: 'ファイルをご確認ください。', buttons: ['OK'] });
            return;
        }
        else if (world > all)d_ = path.dirname(directory);
        else d_ = directory;
        $('#profile_modal').modal('show');
        $('#folder_input').val(d_);
        $('#name').val(path.basename(d_));
        fs.readdir(d_, function(err, files){
            var jar = jar_check(files);
            if (jar.length === 0) return;
            else if (jar.length === 1) $('#jar_input').val(d_ + slash + jar[0]);
            $('#version').parent().parent().hide();
                /*var html = '';
                for (var jar_ in jar){ html += '<li role="presentation"><a role="menuitem" tabindex="-1" href="#">' + path.basename(jar[jar_]) + '</a></li>'; }
                $('#jar_input_div').hide();
                $('#jar_choice_div').show()
                $('#jar_list').html(html);
                $("#jar_choice_div div li a").click(function(){
                    $(this).parents('.dropdown').find('.dropdown-toggle').html($(this).text() + ' <span class="caret"></span>');
                    $(this).parents('.dropdown').find('input[name="dropdown-value"]').val($(this).attr("data-value"));
                });*/
        });
    });
}

//Zip読み込み
function load_zip(base_file){
    $('#profile_modal').data('zip', base_file);
    ipc.send('read_zip', base_file);
    ipc.once('read_zip',function(e, a){
        $('#profile_modal').data('type', a.type).data('count', a.count).data('base', a.base).modal('show');
        $('#name').val(path.basename($('#profile_modal').data('zip'), '.zip'));
        if (a.type === 'all'){
            var jar = jar_check(a.list);
            if (jar.length === 1) $('#jar_input').val('..' + slash + path.basename(jar[0]).replace(/\\/g, slash));
            else if (jar.length !== 0){
                var html = '';
                for (var jar_ in jar){ html += '<li role="presentation"><a role="menuitem" tabindex="-1" href="#">' + path.basename(jar[jar_]) + '</a></li>'; }
                $('#jar_input_div').hide();
                $('#jar_choice_div').show();
                $('#jar_list').html(html);
                $('#name').val(path.basename(base_file, '.zip'));
                $('#jar_choice_div div li a').click(function(){
                    $(this).parents('.dropdown').find('.dropdown-toggle').html($(this).text() + ' <span class="caret"></span>');
                    $(this).parents('.dropdown').find('input[name="dropdown-value"]').val($(this).attr('data-value'));
                });
            }
        }
    });
}

//jarファイル検索
function jar_check(data){
    var l = $.grep(data, function(elem, index){ return (path.extname(elem) === '.jar'); });
    if (l.length === 1) return l;
    else {
        var l_ = $.grep(data, function(elem, index){ return (path.extname(elem) === '.jar' && elem.indexOf('universal') > -1); });
        if (l_.length === 1) return l_;
        else return l;
    }
}

/*function reload_profile(){
    $('#status').empty();
    $.each(profiles, function(i, e){
        $('#status').append('<tr data-toggle="collapse" data-target="#' + e.id + '_status" class="danger clickable ' + e.id + '_status_color"><td>' + e.name + '</td><td id="' + e.id + '_elapsed_list_text">--:--:--</td></tr><tr class="danger ' + e.id + '_status_color"><td colspan="3" style="padding: 0 8px; border:0;"><div id="' + e.id + '_status" class="collapse"><div style="margin: 8px;"><p id="' + e.id + '_status_list_text">ステータス：停止</p><div id="' + e.id + '_status_players"></div></div></div></td></tr>');
    });
}*/

//タブのデータ準備
function profile_ready(id, first){
    ipc.once(id + '_load_log', function(e, data){
        if (data === undefined){
            load_end();
            return;
        }
        logs[id] = $('#' + id + '_log').DataTable({ 'data': data, 'info': false, 'ordering': false, 'scrollY': '10000px', 'scrollCollapse': true, 'paging': true, 'pagingType': 'numbers', 'pageLength': 300, 'lengthChange': false });
        load_end();
        if (first) resize();
    });
    ipc.once(id + '_load_indices', function(e, data){
        if (data === undefined) return;
        indices[id] = data;
    });
    port[id] = [];
}

//タブの内容生成
function create_detail(extra){
    $('main_right .active').removeClass('active');
    if (extra === null ){
        var i_ = 0;
        $.each(profiles, function(i, e){
            add_detail(i_, e);
            i_++;
        });
    } else
        add_detail(0, profiles[extra]);
    function add_detail(i, e){
        $('#' + e.id + '_tab').parent().remove();
        $('#' + e.id + '_content').remove();
        var tab = '';
        var content = '';
        if (i === 0){
            tab = 'active'
            content = ' in active';
        }
        $('#detail_tab').append('<li class="' + tab + '"><a id="' + e.id + '_tab" href="#' + e.id + '_content" data-toggle="tab">' + e.name + '</a></li>');
        $('#detail_content').append('<div class="tab-pane' + content + '" id="' + e.id + '_content" style="margin-top: 4px;"><div id="row"><div class="col-xs-5 s-pad"><p id="' + e.id + '_status_text">ステータス：停止</p><p id="' + e.id + '_start_text" style="overflow-x: hidden;">開始時刻：----/--/-- --:--:--</p><p id="' + e.id + '_nopeople" style="width: 50%; float: right;">無人時間：--:--:--</p><p id="' + e.id + '_elapsed_text">経過時間：--:--:--</p><p id="' + e.id + '_next_text">次回予定：</p><a id="' + e.id + '_port_text" data-toggle="popover" data-html="true" data-placement="right" data-trigger="manual" style="width: 120%; cursor: pointer;">ポート：閉鎖</a><div id="' + e.id + '_players" class="players"></div></div><div class="col-sm-7" style="max-width:400px; float:right; padding:0;" data-id="' + e.id + '"><button class="btn btn-primary btn-block bt-one" onclick="shell.openItem(\'' + tohtml(e.folder) + '\');">作業フォルダーを開く</button><button class="btn btn-primary btn-block bt-one" data-toggle="modal" data-target="#manage_modal">サーバー/ログ/コマンド履歴/バックアップの管理</button><button id="' + e.id + '_edit_button" class="btn btn-warning bt-two" data-toggle="modal" data-target="#profile_modal">プロファイルの編集</button><button id="' + e.id + '_remove_button" class="btn btn-danger bt-two" onclick="remove_profile($(this).parent().data(\'id\'));">プロファイルの削除</button><button id="' + e.id + '_restart_button" class="btn btn-info pull-right bt-four" onclick="restart_server($(this).parent().data(\'id\'));">再起動</button><button id="' + e.id + '_stop_button" class="btn btn-danger pull-right bt-four" onclick="stop_server($(this).parent().data(\'id\'));">停止</button><button id="' + e.id + '_start_button" class="btn btn-success pull-right bt-four" onclick="start_server($(this).parent().data(\'id\'));">起動</button><button class="btn btn-danger pull-right bt-four" onclick="kill_server($(this).parent().data(\'id\'));">強制終了</button></div></div><table id="' + e.id + '_log" class="table table-hover table-condensed"><thead><tr><th data-field="id" data-align="right">時刻</th><th data-field="name" data-align="center">類</th><th data-field="price">ログ</th></tr></thead><tbody></tbody></table><input id="' + e.id + '_cmd_input" type="text" class="form-control input-sm" placeholder="コマンドを入力..." value="過去ログを表示しています" style="display: inline-block; width: 89%; margin: 0 0.5%;"><button id="' + e.id + '_cmd_button" class="btn btn-primary" style="margin: 0 0.5%; width: 9%; padding: 1px; height: 24px;">送信</button></div></div>');
        $('#' + e.id + '_cmd_input').keyup(function(e_){ if (e_.keyCode === 13) send_command(e.id); });
        $('#' + e.id + '_cmd_button').click(function(){ send_command(e.id); });
        $('#' + e.id + '_cmd_input, #' + e.id + '_cmd_button, #' + e.id + '_stop_button, #' + e.id + '_restart_button').prop("disabled", true);
        $('#' + e.id + '_port_text').addClass('text-danger')
        .click(function(evt){
            evt.stopPropagation();
            if (!$(this).attr('aria-describedby')) $(this).popover('show');
            else { $(this).popover('hide'); return; }
            var c = new Clipboard('.pop_button');
            c.on('success', function(e_){
                $('.pop_button').text('コピーしました');
                setTimeout(function(){ $('.pop_button').text('アドレスをコピーする'); }, 2000);
            });
        })
        .popover({
            title: function(){
                if (port[e.id].status === undefined) return 'ポート開放:未実施';
                else if (port[e.id].status) return 'ポート開放:成功';
                else return 'ポート開放:失敗';
            },
            content: function(){
                var ad = port[e.id].global_ip + '%3A' + port[e.id].port;
                var r = '<p>ポート番号: ' + un_to(port[e.id].port) + '</p><p>ローカルメインIP: ' + un_to(port[e.id].local_ip) + '</p><p>ゲートウェイIP: ' + un_to(port[e.id].gateway_ip) + '</p><p>グローバルIP: ' + un_to(port[e.id].global_ip) + '</p><p>外部疎通チェック: ' + un_to(port[e.id].check) + '</p>';
                if (port[e.id].port !== undefined && port[e.id].global_ip !== undefined) r += '<button id="' + e.id + '_pop_button" class="btn btn-primary btn-block pop_button" data-clipboard-text="' + port[e.id].global_ip + ':' + port[e.id].port + '">アドレスをコピーする</button><a href="http://twitter.com/share?url=http%3A%2F%2Fxperd.net%2Ftools%2Fams%2F&text=Minecraftマルチサーバー[' + profiles[e.id].name + '](' + ad + ')" target="_blank" style="background-color: #5EAADE;"><img src="twitter.jpg" alt="Twitter"></a><a href="http://www.facebook.com/share.php?u=' + ad + '" target="_blank" style="background-color: #3A589E;"><img src="facebook.jpg" alt="Facebook"></a><a href="https://plus.google.com/share?url=' + ad + '" target="_brank" style="background-color: #DC4E42;"><img src="google-plus.jpg" alt="Google+"></a>';
                return r;
            },
        });
        $('#' + e.id + '_cmd_input').autoComplete({
            minChars: 0, cache: 0,
            source: function(term, suggest){
                term = term.toLowerCase();
                var choices = indices[e.id];
                var matches = [];
                for (var i = 0; i < choices.length; i++) if (~choices[i].toLowerCase().indexOf(term)) matches.push(choices[i]);
                suggest(matches);
            }
        });
        ipc.send('load_data', e);
    }

    function un_to(value){
        if (value === undefined) return '';
        else return value;
    }
}

//読み込み終了
function load_end(e){
    if (e){ //初期起動&プロファイルなし
        $('#loading').hide();
        if ($(window).width() <= 1380) menu();
    }
    load_end_count++;
    if (Object.keys(profiles).length <= load_end_count){
        $('#loading').hide();
        resize();
    }
}

//プロファイル削除
function remove_profile(id){
    var p = profiles[id];
    dialog.showMessageBox(browserWindow.getFocusedWindow(), {
        title: 'プロファイルの削除', type:'question', message:'[' + p.name + ']を削除しますか？',detail:'プロファイルのみではデータは残るので、また同じワールドで遊ぶことができます\n※データも削除ではもう二度と同じワールドで遊ぶことはできません',
        buttons:['プロファイルのみ削除', 'あわせてデータも削除', 'キャンセル'], cancelId:-1, defaultId:2 },
        function(i){
            if (i === -1 || i === 2) return;
            else if (i === 1 && fs.existsSync(p.folder))
                try { del(p.folder, { force: true });
                } catch (ex){ alert('フォルダーを削除できませんでした\nパス:' + p.folder); }
            delete profiles[p.id];
            fs.writeFile(base_dir + 'profile.ams', JSON.stringify(profiles), (error) => { /* handle error */ });
            $('#' + p.id + '_tab').parent().remove();
            $('#' + p.id + '_content').remove();
        }
    );
}

//進行状況(親)
function progress(id, jar, zip){
    profile_close = true;
    $('#profile_modal_close').prop('disabled', true);
    $('#profile_modal_body *').prop('disabled', true);
    $('#profile_modal_footer').children().prop('disabled', true);
    $('#progress').parent().show();
    $('#progress_text').show();
    if (jar !== undefined && zip === undefined) start_download(id, jar.ver, jar.type, jar.latest, 1);
    else if (jar === undefined && zip !== undefined) start_unzip(id, zip.data, zip.base, zip.count, zip.type, 1);
    else if (jar !== undefined && zip !== undefined) start_unzip(id, zip.data, zip.base, zip.count, zip.type, 0.3, jar);
}

//パーセント管理
function percent(i, text){
    $('#progress').width(i + '%');
    $('#progress_text').text(text);
}

//解凍処理(GUI)
function start_unzip(id, file, base, data_count, type, per, extra){
    percent(1, '解凍開始中...(1%)');
    ipc.send('unzip', { profile: profiles[id], file: file, base: base, type: type });
    ipc.on('unzip_progress', function(e, a){
        var i = Math.round(a / data_count * per * 100);
        percent(i, '解凍中...(' + i + '% ' + a + '/' + data_count + 'ファイル)');
    });
    ipc.once('unzip_finish', function(e, a){
        percent(100 * per, '解凍完了(' + 100 * per + '%)');
        ipc.removeAllListeners('unzip_progress');
        if (extra !== undefined) start_download(id, extra.ver, extra.type, extra.latest, 0.7);
        else end_progress(id);
        return;
    });
}

//ダウンロード処理
function start_download(id, ver, mode, latest, per){
    var url = '';
    var file = '';
    var base_p = 100 - per * 100;

    function p(p){
        return base_p + Math.round(p * per);
    }

    if (mode === 'Vanila'){
        url = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + ver + '/minecraft_server.' + ver + '.jar';
        file = 'minecraft_server.' + ver + '.jar';
        require('request-progress')(request(url), { throttle: 200 })
        .on('progress', function(state){
            percent(p(state.percent * 100), 'ダウンロード中... ' + round(state.time.remaining) + '(' + p(state.percent * 100) + '% ' + Math.round(state.size.transferred / 1000) + '/' + Math.round(state.size.total / 1000) + 'KB)');
        })
        .on('error', function(err){ })
        .pipe(fs.createWriteStream(profiles[id].folder + slash + file))
        .on('close', function(err){
            percent(p(100), 'ダウンロード完了');
            end_progress(id, profiles[id].folder + slash + file);
        });
    }
    else {
        $.ajax({
            url: 'http://files.minecraftforge.net/maven/net/minecraftforge/forge/index_' + ver + '.html',
            type: 'GET',
            success: function(data){
                d = data;
                percent(p(3), 'HTML解析中...(' + p(3) + '%)');
                var s = 0;
                if (!latest){ // 推奨
                    s = data.indexOf('Download Recommended');
                    if (s === -1) s = data.indexOf('Download Latest');
                }
                else { // 最新
                    s = data.indexOf('Download Latest');
                }
                var s_ = data.indexOf('Changelog', s);
                var start = data.indexOf('url=', s_);
                var end = data.indexOf('"', start);
                url = data.slice(start + 4, end);
                file = path.basename(url);
                percent(p(5), 'ダウンロード開始中...(' + p(5) + '%)');
                require('request-progress')(request(url), { throttle: 200 })
                .on('progress', function(state){
                    percent(p(Math.round(5 + state.percent * 100 * 0.1)), 'ダウンロード中... ' + round(state.time.remaining) + '(' + p(Math.round(5 + state.percent * 100 * 0.1)) + '% ' + Math.round(state.size.transferred / 1000) + '/' + Math.round(state.size.total / 1000) + 'KB)');
                })
                .on('error', function(err){})
                .pipe(fs.createWriteStream(profiles[id].folder + slash + file))
                .on('close', function(err){
                    var c = 0;
                    percent(p(15), 'インストール開始中...(' + p(15) + '%)');
                    var e = exec('java', ['-jar', file, '--installServer'], { cwd: profiles[id].folder });
                    e.stdout.on('data', function(data){
                        console.log(data.toString());
                        if (data.toString().indexOf('you should now be able to run the file') > -1)
                            file = data.toString().slice(data.toString().indexOf('file') + 5, data.toString().indexOf('.jar') + 4);
                        c++;
                        percent(p(Math.round(15 + c / 1.5)), 'インストール中...(' + p(Math.round(15 + c / 1.5)) + '%)');
                    });
                    //e.stderr.on('data', function(data){ console.log(data.toString()); })
                    e.on('exit', function(code){
                        percent(p(100), 'インストール完了');
                        end_progress(id, profiles[id].folder + slash + file);
                    });
                });
            },
            error: function(xhr, status, err){}
        });
        percent(p(1), 'HTML取得中...(' + p(1) + '%)');
    }
}

//終了処理
function end_progress(id, jar){
    if (jar !== undefined) profiles[id].jar = jar;
    fs.writeFile(base_dir + 'profile.ams', JSON.stringify(profiles), (error) => { /* handle error */ });
    $('#' + id + '_tab').parent().remove();
    $('#' + id + '_content').remove();
    $('.active').removeClass('active');
    //reload_profile();
    create_detail(id);
    profile_close = false;
    $('#profile_modal').modal('hide');
    profile_ready(id, true);
}

//外部アドレスコピー
function copy_address(id){
    (new Clipboard('#' + id + '_pop_button'))
    .on('success', function(e){
        $(this).text('コピーしました');
        setTimeout(function(){ $(this).text('アドレスをコピーする'); }, 2000);
    });
}

//予測変換保存
function save_indices(id, text){
    if (indices[id].indexOf(text) >= 0 || text === 'stop' || text === '')
        return;
    if (text !== undefined)
        indices[id].push($('#' + id + '_cmd_input').val());
    fs.writeFile(profiles[id].folder + slash + 'indices.ams', JSON.stringify(indices[id]), (error) => { /* handle error */ });
}

//0の挿入
function padZero(v){
    if (v < 10) return '0' + v;
    else return v;
}

//ソート用
function hikaku(v1, v2){
    v1.replace(/_/g, '').replace(/-/g, '');
    v2.replace(/_/g, '').replace(/-/g, '');
    if (v1.toString() < v2.toString()) return 1;
    else return -1;
}

//バックアップ開始
function backup(id){
    backup_flag[id] = true;
    send_command(id, 'save-all');
}

//HTMLエスケープ
function tohtml(t){
    return t.replace(/\\/g, '\\\\');
}

//UUID作成
function uuid(){
    var S4 = function(){  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1); }
    return ( S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4()) ;
}

function getAvatarURL(name, callback) {
    request({
        url: 'https://api.mojang.com/users/profiles/minecraft/' + name,
        json: true,
    }, (err, res, body) => {
        if (err || !body) return callback('');
        callback('https://crafatar.com/avatars/' + body.id);
    });
}

//現在時刻
function time(extra){
    var DD = new Date();
    var Year = DD.getFullYear();
    var Month = DD.getMonth() + 1;
    var Day = DD.getDate();
    var Hours = padZero(DD.getHours());
    var Minutes = padZero(DD.getMinutes());
    var Seconds = padZero(DD.getSeconds());
    //var Milliseconds = padZero(DD.getMilliseconds(), true);
    if (extra)
        return Year + '/' + Month + '/' + Day + ' ' + Hours + ':' + Minutes + ':' + Seconds;
    else
        return Hours + ':' + Minutes + ':' + Seconds;
}

//バージョン比較
function versionCompare(v1, v2, options){
    var lexicographical = options && options.lexicographical
      ,
    zeroExtend = options && options.zeroExtend
      ,
    v1parts = v1.split('.')
      ,
    v2parts = v2.split('.');
    function isValidPart(x){
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }
    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart))
        return NaN;
    if (zeroExtend){
        while (v1parts.length < v2parts.length)
            v1parts.push('0');
        while (v2parts.length < v1parts.length)
            v2parts.push('0');
    }
    if (!lexicographical){
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }
    for (var i = 0; i < v1parts.length; ++i){
        if (v2parts.length === i)
            return 1;
        if (v1parts[i] === v2parts[i])
            continue;
        else if (v1parts[i] > v2parts[i])
            return 1;
        return -1;
    }
    if (v1parts.length !== v2parts.length)
        return -1;
    return 0;
}

function round(sec) {
    if (typeof sec != 'number') return '残り時間計測中'
    var ms = sec * 1000
    var unit = ['時間', '分', '秒']
    var time = [3600000, 60000, 1000]
    var v = 2
    if (ms > time[1]) v = 1
    if (ms > time[0]) v = 0
    return '残り約' + Math.round(ms / time[v]) + unit[v]
}
