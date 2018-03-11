/* global process */
'use strict';

const electron = require("electron");
const app = electron.app;
const shell = electron.shell;
const browserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;
const dialog = electron.dialog;
const menu = electron.menu;
const fs = require('fs');
const path = require('path');
const copy = require('ncp');
const del = require('del');
const slash = ((process.platform === 'win32') ? '\\' : '/');
var settings;
var mainWindow = null;

/*electron.CrashReporter.start({
    productName: 'Auto_Minecarft_Server',
    companyName: 'Xperd',
    autoSubmit: true
});*/


app.on('window-all-closed', function() {
    if (process.platform != 'darwin')
        app.quit();
});

var handleStartupEvent = function() {
  if (process.platform !== 'win32') {
    return false;
  }

  function executeSquirrelCommand(args, done) {
      var updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'update.exe');
      require('child_process').spawn(updateDotExe, args, { detached: true });
   };

   function install(done) {
      var target = path.basename(process.execPath);
      executeSquirrelCommand(["--createShortcut", target], done);
   };

   function uninstall(done) {
      var target = path.basename(process.execPath);
      executeSquirrelCommand(["--removeShortcut", target], done);
   };

  var squirrelCommand = process.argv[1];
  switch (squirrelCommand) {
    case '--squirrel-install':
      install();
      return false;
    case '--squirrel-updated':

      // Optionally do things such as:
      //
      // - Install desktop and start menu shortcuts
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Always quit when done

      app.quit();

      return true;
    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Always quit when done
      uninstall();
      return false;
    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated
      app.quit();
      return true;
  }
};

if (handleStartupEvent()) {
  return;
}

app.on('ready', function() {
    //Menu.setApplicationMenu(null);
    if (process.argv[1] === '--squirrel-uninstall'){
        dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
            title: 'アンインストール完了',
            type: 'warning',
            message: 'このソフトのデータは削除しましたが、ワールドデータなどは消えていません。\n各自で削除するようにしてください。',
            buttons: ['了解']},
            function(){  app.quit(); }
        );
        return;
    }
    else if (process.argv[1] === '--squirrel-install'){
        mainWindow = new BrowserWindow({width: 800, height: 200, icon: __dirname + '/favicon.ico', frame: false});
        mainWindow.loadURL('file://' + __dirname + '/install.html');
        mainWindow.on('closed', function() {
            mainWindow = null;
        });
        return;
    }
    else{
        mainWindow = new BrowserWindow({width: 1200, height: 800, "min-width": 800, "min-height": 500, icon: __dirname + '/favicon.ico', frame: true});
        mainWindow.loadURL('file://' + __dirname + '/index.html');
        mainWindow.webContents.on('new-window', (event, url) => {
            event.preventDefault();
            shell.openExternal(url);
        });
        mainWindow.on('closed', function() {
            mainWindow = null;
        });
    }
    //mainWindow.toggleDevTools();
    ipc.on('settings', function(e, a){ settings = a; });
    ipc.on('load_manage', load_manage);
    ipc.on('load_data', load_data);
    ipc.on('backup', backup);
    ipc.on('restore', restore);
    ipc.on('backup_move', backup_move);
    ipc.on('save_properties', save_properties);
    ipc.on('unzip', unzip);
    ipc.on('read_zip', read_zip);

    // アップデートチェック
    let now = Date.now();
    let sendUpdate = val => {
      setTimeout(() => {
        mainWindow.webContents.send('update', val);
      }, (now + 3000 < Date.now()) ? 0 : 3000 - (Date.now() - now));
    };

    var updater = new GhReleases({
        repo: 'AutoMinecraftServer/AutoMinecraftServer',
        currentVersion: app.getVersion()
    });

    updater.check(function(err, status) {
        if (err && err.message === 'There is no newer version.') {
            sendUpdate('update-not-available');
        } else if (err && err.message === 'Can not find Squirrel') {
            sendUpdate('update-available');
        } else if (!err && status) updater.download();
    });

    updater.on('update-downloaded', function() {
        sendUpdate('update-ready');
        require("electron").dialog.showMessageBox({
            title: 'アップデートのダウンロード完了',
            message: '今すぐ最新のソフトに更新できます',
            detail: 'もしここで実行しなくても、次回起動時にインストールされます',
            buttons: ['再起動', '後で'],
            cancelId: -1 },
            function name(i) {
                if (i === 0) require("electron").autoUpdater.quitAndInstall();
            }
        );
    })
});

function load_data(e, a){
    fs.readFile(a.folder + slash + 'logs' + slash + 'latest.log', 'utf8', function(err, t_){
        if (err) { e.sender.send(a.id + '_load_log', undefined); return; }
        if (t_ === '' || t_ === null) return;
        let data = new Array();
        let log_array = t_.split(/\r\n|\r|\n/);
        for (let i = 0; i < log_array.length; i++){
            let e__ = '';
            let e_ = require('encoding-japanese').convert(new Buffer(log_array[i]), 'UTF-8', 'SJIS');
            for(let i_ = 0, len = e_.length; i_ < len; i_++) {
                if (e_[i_] < 0) e_[i_] = e_[i_] * -1;
                e__ += "%" + e_[i_].toString(16);
            }
            try { var log = decodeURIComponent(e__); }
            catch(ex) {}
            if (log !== '' && log !== null && log.indexOf('[') === 0){
                let index = log.indexOf(':', 10);
                data.push([ log.substr(1, 8), 'Info', log.substr(index + 2) ]);
            }
            else if (log !== '' && log !== null) data.push([ '', 'ERROR', log ]);
        }
        e.sender.send(a.id + '_load_log', data);
    });
    fs.readFile(a.folder + slash + 'indices.ams', 'utf8', function(err, t_){
        if (err) { e.sender.send(a.id + '_load_indices', ["achievement", "ban", "ban-ip", "banlist", "blockdata", "clear", "clone", "debug", "defaultgamemode", "deop", "difficulty", "effect", "enchant", "entitydata", "execute","fill", "gamemode", "gamerule", "give", "help", "kick", "kill", "list", "me", "op", "pardon", "pardon-ip", "particle", "playsound", "replaceitem", "save-all", "save-off", "save-on", "say", "scoreboard", "seed", "setblock", "setidletimeout", "setworldspawn", "spawnpoint", "spreadplayers", "stats", "stop", "tell", "tellraw", "testfor", "testforblock", "testforblocks", "time", "title", "toggledownfall", "tp", "trigger", "weather", "whitelist", "worldborader", "xp"]); return; }
        if (t_ === '' || t_ === null) return;
        e.sender.send(a.id + '_load_indices', JSON.parse(t_));
    });
}

function load_manage(e, a){
    fs.readFile(a.folder + slash + 'server.properties', 'utf8', function (err, t_) {
        if (err) { e.sender.send('load_properties', undefined); return; }
        let pro_array = {};
        let text_array = t_.split(/\r\n|\r|\n/);
        for (let i = 0; i < text_array.length; i++){
            if (text_array[i] !== '' && text_array[i] !== null && text_array[i].slice(0, 1) !== '#'){
                let index = text_array[i].indexOf('=');
                pro_array[text_array[i].slice(0, index).replace('.', '_')] = text_array[i].slice(index + 1);;
            }
        }
        e.sender.send('load_properties', {location:a.folder + slash + 'server.properties', data:pro_array});
    });
    fs.readdir(a.folder + slash + 'logs', function (err, files) {
        if (files === '' || err){
            e.sender.send('load_logs', undefined);
            return;
        }
        let files_ = [];
        files_.push(a.folder + slash + 'logs');
        for (let i = 0; i < files.length; i++){
            files_.push(a.folder + slash + 'logs' + slash + files[i]);
        }
        e.sender.send('load_logs', files_);
    });
    fs.readdir(dir(a), function (err, folders) {
        if (folders === '' || err){
            e.sender.send('load_backup', undefined);
            return;
        }
        folders.sort(hikaku);
        let folders_ = [];
        folders_.push(dir(a));
        for (let i = 0; i < folders.length; i++){
            folders_.push(dir(a) + slash + folders[i]);
        }
        e.sender.send('load_backup', { data: folders_, id: a.id });
    });
}

function backup(e, a, b){
    fs.readdir(dir(a), function (err, folders) {
        if (err) return;
        let folders_ = [];
        let remove = [];
        folders.sort(hikaku);
        for (let i = 0; i < folders.length; i++){
            let f = folders[i];
            if (f.length === 19 && f.indexOf('.') === -1 && f.indexOf('-') === 4 && f.indexOf('_') === 10)
                if (folders_.length === a.backup_count - 1) remove.push(f);
                else folders_.push(f);
        }
        for (let i = 0; i < folders.length; i++){
            let r = remove[i];
            if (dir(a) + slash + r !== b) require('rimraf')(dir(a) + slash + r, function(error){});
        }
        if (fs.existsSync(a.folder + slash + 'world')) copy(a.folder + slash + 'world', dir(a) + slash + time(), function(err){
            if (b !== undefined) del([a.folder + slash + 'world' + slash + '**', '!' + a.folder + slash + 'world'], {force: true}).then(paths => {
                copy(b, a.folder + slash + 'world', function(err){});
                e.sender.send('restore_success', '');
            });
        });
    });
}

function restore(e, a){
    backup(e, a.profile, a.backup);
}

function backup_move(e, a){
    if (a.mode){
        collect(a.p, []);
        function collect(all, already){
            if (Object.keys(all).length === already.length){
                //終了
                e.sender.send('backup_move_finish', '');
                return;
            }
            for (let i in all){
                if (already.indexOf(i) < 0){
                    already.push(i);
                    copy(dir(a.p[i], false), dir(a.p[i], true), function(err){ del([dir(a.p[i], false)], {force: true}).then(paths => { collect(all, already); }); });
                    return;
                }
            }
        }
    }
    else {
        back(a.p, []);
        function back(all, already){
            if (Object.keys(all).length === already.length){
                //終了
                del([settings.backup_dir], {force: true}).then(paths => { e.sender.send('backup_move_finish', ''); });
                return;
            }
            for (let i in all){
                if (already.indexOf(i) < 0){
                    already.push(i);
                    copy(dir(a.p[i], true), dir(a.p[i], false), function(err){ back(all, already); });
                    return;
                }
            }
        }
    }
}

function save_properties(e, a){
     fs.writeFile(a.location, "#Minecraft server properties\n#Saved by Auto Minecraft Server\n" + JSON.stringify(a.data).replace(/"/g, '').replace('{', '').replace('}', '').replace(/_/g, '.').replace(/:/g, '=').replace(/,/g, "\n"));
}

function read_zip(e, a){
    let count = 0;
    let list = [], all_list = [], world_list = [];
    let type = '', base = '';
    fs.createReadStream(a).pipe(require('unzip').Parse())
    .on('entry', function(entry){
        if (entry.type !== 'File'){
            entry.autodrain();
            return;
        }
        count++;
        let name = path.basename(entry.path);
        list.push(entry.path);
        if (name === 'level.dat' || name === 'level.dat_old' || name === 'session.lock' || name === 'DIM1' || name === 'DIM-1' || name === 'playerdata' || name === 'region' || name === 'stats') world_list.push(path.dirname(entry.path));
        else if (name === 'server.properties' || name === 'whitelist.json' || name === 'usercache.json' || name === 'ops.json' || name === 'banned-players.json' || name === 'banned-ips.json' || name.indexOf('.jar') > 0) all_list.push(path.dirname(entry.path));
        entry.autodrain();
    })
    .on('close', function(){
        if (all_list.length > 0){
            type = 'all';
            base = all_list[0];
        }
        else if (world_list.length > 0){
            type = 'world';
            base = world_list[0];
        }
        e.sender.send('read_zip', { base: base, type: type, count: count, list: list });
    });
}

function unzip(e, a){
    let count = 0;
    if (a.type === 'world' && !fs.existsSync(a.profile.folder + slash + 'world')) try { fs.mkdirSync(a.profile.folder + slash + 'world'); } catch(ex){}
    fs.createReadStream(a.file).pipe(require('unzip').Parse())
    .on('entry', function(entry){
        let file = '';
        if (entry.type !== 'File'){
            if (a.type === 'world') file = a.profile.folder + slash + 'world' + entry.path.replace(a.base, '').replace(/\//g, slash);
            else if (a.type === 'all') file = a.profile.folder + slash + entry.path.replace(a.base, '').replace(/\//g, slash);
            if (!fs.existsSync(file)) try { fs.mkdirSync(file); } catch(ex){}
            entry.autodrain();
            return;
        }
        if (a.type === 'world') file = a.profile.folder + slash + 'world' + entry.path.replace(a.base, '').replace(/\//g, slash);
        else if (a.type === 'all') file = a.profile.folder + slash + entry.path.replace(a.base, '').replace(/\//g, slash);
        entry.pipe(fs.createWriteStream(file));
        count++;
        e.sender.send('unzip_progress', count);
    })
    .on('close', function(){
        e.sender.send('unzip_finish', count);
    });
}

function time(){
    let DD = new Date();
    let Year = DD.getFullYear();
    let Month = DD.getMonth() + 1;
    let Day = DD.getDate();
    let Hours = padZero(DD.getHours());
    let Minutes = padZero(DD.getMinutes());
    let Seconds = padZero(DD.getSeconds());
    //let Milliseconds = padZero(DD.getMilliseconds(), true);
    return Year + "-" + padZero(Month) + "-" + padZero(Day) + "_" + Hours + "-" + Minutes + "-" + Seconds;
}

function padZero(v, m) {
    if (m){
        if (v < 10) return "00" + v;
        if (v < 100) return "0" + v;
        else return v;
    }
    if (v < 10) return "0" + v;
    else return v;
}

function hikaku(v1, v2){
    v1.replace('_', '');
    v1.replace('-', '');
    v2.replace('_', '');
    v2.replace('-', '');
    if (v1.toString() < v2.toString()) return 1;
    else return -1;
}

function dir(p, e){
    if (settings.backup_dir_bool && e === undefined || e) return settings.backup_dir + slash + p.id;
    else if (!settings.backup_dir_bool && e === undefined || !e) return p.folder + slash + 'backup';
}
