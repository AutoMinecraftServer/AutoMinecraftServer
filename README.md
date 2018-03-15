# Auto Minecraft Server

Minecraftのサーバーを自動化するためのソフトです。  
質問等はリンク先のフォーラムか<xperd00@gmail.com>にお願いします。  

## 使い方

<http://xperd.net/auto-minecraft-server/>で配布されているものをインストールして使ってください。  

## ビルド方法

electron-packagerを使用しています。   
```
electron-packager . ams `
  --platform="linux,win32" `
  --arch="ia32,x64,armv7l" `
  --electron-version=1.8.2 `
  --overwrite `
  --asar `
  --icon=".\favicon.ico" `
  --win32metadata.CompanyName="Xperd" `
  --win32metadata.FileDescription="Auto Minecraft Server" `
  --win32metadata.OriginalFilename="ams.exe" `
  --win32metadata.ProductName="Auto Minecraft Server" `
  --app-copyright="Copyright 2018 Xperd. Rights Reserved"
``` 

Windows版はこれに加えGruntによるコンパイルをしています。  
```javascript:Gruntfile.js
module.exports = function(grunt) {
    grunt.initConfig({
        'create-windows-installer': {
            x64: {
                appDirectory: 'ams-win32-x64',
                outputDirectory: 'build/ams-win32-x64',
                authors: 'Xperd',
                description: 'Auto Minecraft Server',
                exe: 'ams.exe',
                title: 'Auto Minecraft Server',
                iconUrl: 'https://raw.githubusercontent.com/AutoMinecraftServer/AutoMinecraftServer/master/favicon.ico',
                noMsi: true
            },
            ia32: {
                appDirectory: 'ams-win32-ia32',
                outputDirectory: 'build/ams-win32-ia32',
                authors: 'Xperd',
                description: 'Auto Minecraft Server',
                exe: 'ams.exe',
                title: 'Auto Minecraft Server',
                iconUrl: 'https://raw.githubusercontent.com/AutoMinecraftServer/AutoMinecraftServer/master/favicon.ico',
                noMsi: true,
            }
        }
    });
    grunt.loadNpmTasks('grunt-electron-installer');
}
```

## 作者

Xperd [Twitter(@xperd00)](https://twitter.com/xperd00) [サイト](http://xperd.net)

## ライセンス

[MIT](http://b4b4r07.mit-license.org)