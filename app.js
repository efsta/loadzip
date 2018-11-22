'use strict'



// ...\nar> npm install -g npm@2
// ...\nar> npm install pug (???? wie bekommt man alle Abhängigkeiten installiert, unabhängig davon, was bereits global installiert ist).
// ...\nar> CD node_modules
// ...\node_modules> \e\efrbuild\7-zip\7z a pug.zip pug\*.* -r

// Idee: ...\myprog> npm install, 7z a myprog.zip *.* -r
// dann node load myprog, NMroot = curdir, NMfs = new NM('myprog.zip')


//var NMroot, NMcache = {}, NMcur, NMsub
//const NMfs = {
//    readFileSync: function (path, options) {
//        console.log('readFileSync >>>', path)
//        return cachedNM(path) ? NMcur.readFileSync(NMsub, options) : FS.readFileSync(path, options)
//    },
//    realpathSync: function (path, options) {
//        console.log('realpathSync >>>', path)
//        return cachedNM(path) ? path : FS.realpathSync(path, options)
//    },
//    statSync: function (path, options) {
//        console.log('statSync >>>', path)
//        return cachedNM(path, true) ? NMcur.statSync(NMsub) : FS.statSync(path, options)
//    }
//}
//global.$NMfs = NMfs                             // for workaround in pug-filters/node_modules/uglify-js/tools/node.js
//function cachedNM(path, create) {
//    path = path.replace(/^(\\\\\?\\)?[A-Z]:/, '').replace(/\\/g, '/')
//    if (!NMroot) { NMroot = path + '/'; return }
//    if (path.slice(0, NMroot.length) !== NMroot) return
//    NMsub = path.slice(NMroot.length)
//    var i = NMsub.indexOf('/')
//    if (-1 === i && !/\./.test(NMsub)) try { NMcur = NMcache[NMsub] || (create ? NMcache[NMsub] = new NM(NMroot + NMsub + '.zip') : null) } catch (err) { NMcur = NMcache[NMsub] = null }
//    else NMcur = NMcache[NMsub.slice(0, i)]
//    return NMcur ? true : false
//}
//NMroot = '/nar/node_modules/pug/'


//global.$app = 'E:/nar'
//var x = require('./Maint/Manifest.js')
//x.proc(function (err) {
//    console.log(err)
//})

console.log(global.$ZFS.readFileSync('E:/nar/aäeioöuü.txt', 'utf8'))

//var mod = require('fs-monkey')
//mod.patchRequire(NMfs)
console.time('TEST')
const Pug = require('pug')
console.timeEnd('TEST')
var fn = Pug.compile((global.$ZFS||require('fs')).readFileSync('Page1.pug', 'utf8'))
console.log(fn({ name: 'HUGO' }))
//var Forge = require('node-forge')
console.log()

//var Mock = require('mock-require')
//Mock('fs', NMfs)
//var Forge = require('node-forge')

//var usb = require('usb')

var PCSC = require('pcsclite')()
PCSC.on('reader', function (reader) {
    console.log(reader.name, 'found')
    reader.on('status', function (status) { console.log(reader.name, 'status') })
    reader.on('error', function (err) { console.log(reader.name, err) })
    reader.on('end', function () { console.log(reader.name, 'end') })
})
PCSC.on('error', function (err) { console.log('PCSC', err) })
