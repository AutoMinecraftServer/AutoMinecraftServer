# Auto Minecraft Server

Minecraftのサーバーを自動化するためのソフトです。  
質問等はリンク先のフォーラムか<xperd00@gmail.com>にお願いします。  

## 使い方

<http://xperd.net/auto-minecraft-server/>で配布されているものをインストールして使ってください。  

## ビルド方法

electron-packagerを使用しています。   
`electron-packager %ソースパス% ams --platform=all --arch=all --electron-version=%Elelctronの最新バージョン% --overwrite --asar=true --icon="%ソースパス%\favicon.ico" --name="Auto Minecraft Server" --version-string.CompanyName="Xperd" --version-string.LegalCopyright="Copyright 2018 Xperd. Rights Reserved" --version-string.FileDescription="Auto Minecraft Server" --version-string.OriginalFilename="ams.exe" --version-string.ProductName="Auto Minecraft Server"`  

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