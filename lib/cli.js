#!/usr/bin/env node

/*
===========================================================================
  S E T T I N G    S T U F F    U P
===========================================================================
*/

var args = [];

process.argv.slice(2).forEach(function(arg) {
  var flag = arg.split('=')[0];

  switch (flag) {
    case 'debug':
      args.push('--nodeDebug');
      args.push('true');
      break;
    case '-d':
    case '--debug':
    case '--debug-brk':
      args.push('--v8Debug');
      args.push('true');
      break;
    default:
      args.push(arg);
      break;
  }
});

var fs = require('fs'),
    path = require('path'),
    os = require('os'),
    unzip = require('unzip'),
    Q = require('q'),
    request = require('request'),
    Download = require('download'),
    shelljs = require('shelljs/global'),
    _ = require('underscore');


/*
---------------------------------------------------------------------------
  S E T T I N G    S T U F F    U P
---------------------------------------------------------------------------
*/
var colors = require('colors');

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

const knownTemplates2 = [
  {
    id   : 'ionic-shell',
    repo : 'http://github.com/MobileCaddy/shell-ionic/archive/master.zip',
    name : 'mobilecaddy-shell-ionic',
    desc : 'Empty Ioinc skeleton project'
  },
  {
    id   : 'ionic-seed-expenses',
    repo : 'https://github.com/MobileCaddy/seed-expenses-ionic/archive/master.zip',
    name : 'mobilecaddy-seed-expenses-ionic',
    desc : 'Ionic Time & Expenses App'
  }
];


/*
---------------------------------------------------------------------------
  H E L P
---------------------------------------------------------------------------
*/

// TODO use minimist instead
var optimist = require('optimist').
    usage('Usage: \n' +
      'mobilecaddy new <template|git-zip-url> <your-app-name>\n' +
      'mobilecaddy serve [options]\n' +
      'mobilecaddy templates').
    describe('help', 'Print MobileCaddy help menu').
    describe('version', 'Print MobileCaddy version').
    describe('local', 'Run \'serve\' against local mock data rather than SFDC').
    describe('rec', 'Record SFDC responses during a \'serve\' and populate \'mock\' files').
    describe('scrub=[true|false]', 'Clears local data (\'full\'=inc oauth) upon \'serve\'');

var argv = optimist.parse(args);


if (argv.help || argv.h) {
  optimist.showHelp();
  process.exit(0);
}

if (argv.version || argv.v) {
  console.log('mobilecaddy-cli : ' + require(path.join(__dirname, '../package.json')).version);
  try {
    json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('Current project ('+ json.name + ') : ' + json.version);
  } catch (err) {
    // do nothing
  }
  process.exit(0);
}

if (argv._.length === 0) {
  optimist.showHelp();
  process.exit(0);
}

/*
===========================================================================
  C H O O S I N G    T H E    C O M M A N D
===========================================================================
*/
switch (args[0]) {
  case 'new':
    runNew();
    break;
  case 'serve':
    runServe();
    break;
  case 'templates':
    runTemplates();
    break;
  default :
    runUnknownTask();
}


/*
===========================================================================
  N E W
===========================================================================
*/
function runNew(){
  if (args[1] && args[2]) {
    var targetPath = args[2];
    if(targetPath == '.') {
      console.error('Invalid target path, you may not specify \'.\' as an app name'.error);
      process.exit(0);
    }
    getTemplatesList().then(function(knownTemplates){
      var template = _.find(knownTemplates, function(el){return el.id == args[1];})
      if (!template) {
        if (validURL(args[1])) {
          template = {repo: args[1], name : "dummy"};
        }
      }
      if (template) {
        console.log('Cloning MobileCaddy template "' + args[1] + '" from ' + template.repo);
        fetchArchive(targetPath, template).then(function(){
          console.log('Clone complete'.info);
          return installNpmDeps(targetPath);
        }).then(function(){
          console.log('NPM dependancies installed'.info);
          cd(targetPath);
          return installBowerDeps(targetPath);
        }).then(function(){
          console.log('Bower dependancies installed'.info);
          return runInitGruntTask(targetPath)
        }).then(function(){
          console.log('Grunt tasks completed'.info);
          process.exit(0);
        }).catch(function(err){
          console.error(err.error);
          process.exit(0);
        });
      } else if (validURL(args[1])) {
        console.log("That looks like a URL, nice");
        process.exit(0)
      } else {
        console.error('Unknown template ' + args[1].error);
        process.exit(0);
      }
    });
  } else {
    console.error('You need more arguments, man!'.error);
    //optimist.showHelp();
    process.exit(0);
  }
}

function validURL(str) {
  var strRegex = "^((https|http|ftp)?://)"
        + "?(([0-9a-z_!~*'().&=+$%-]+: )?[0-9a-z_!~*'().&=+$%-]+@)?" //ftp的user@
        + "(([0-9]{1,3}\.){3}[0-9]{1,3}" // IP形式的URL- 199.194.52.184
        + "|" // 允许IP和DOMAIN（域名）
        + "([0-9a-z_!~*'()-]+\.)*" // 域名- www.
        + "([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]\." // 二级域名
        + "[a-z]{2,6})" // first level domain- .com or .museum
        + "(:[0-9]{1,4})?" // 端口- :80
        + "((/?)|" // a slash isn't required if there is no file name
        + "(/[0-9a-zA-Z_!~*'().;?:@&=+$,%#-]+)+/?)$";
  var re=new RegExp(strRegex);
  if (!re.test(str)) return false; else return true;
}


/*
===========================================================================
  S E R V E
===========================================================================
*/
function runServe(){
  var scrub = "";
  if (argv.scrub) {
    scrub = "--scrub=" + argv.scrub;
  }
  var local = "";
  if (argv.local) {
    local = "--local=true";
  }
  var rec = "";
  if (argv.rec) {
    rec = "--rec";
  }
  var child = exec('grunt serve ' + scrub + ' ' + local + ' ' + rec, {async:true});
  child.stdout.on('data', function(data) {
  });
}


/*
===========================================================================
  T E M P L A T E S
===========================================================================
*/
function runTemplates(){
  getTemplatesList().then(function(knownTemplates){
    knownTemplates.forEach(function(el){
      console.log(el.id.info + ' : ' +el.desc);
    });
  });
}


/*
===========================================================================
  U N K N O W N    T A S K
===========================================================================
*/
function runUnknownTask(){
  console.error('Unknown task ' + args[0] + '!'.error);
  //optimist.showHelp();
  process.exit(0);
}


/*
 fetchArchive
 Desc: pulls git repo down and moves it into desired sub dir.
   Also does some small string replacement
 TODO : lots more can be done here based on CLI input
 */
function fetchArchive(targetPath, template) {
  var q = Q.defer();
  var replace = require("replace");

  var archiveUrl = template.repo
  // The folder name the project will be downloaded and extracted to
  var message = ['Downloading:'.bold, archiveUrl].join(' ');
  console.log(message);

  var tmpFolder = os.tmpdir();
  var tempZipFilePath = path.join(tmpFolder, 'mobilecaddy-' + new Date().getTime());

  new Download({mode: '755', extract: true})
    .get(archiveUrl)
    .dest(tempZipFilePath)
    .run(function (err, files) {
        if (!err) {
          fs.rename(files[0].path, targetPath,
            function(res){
              if (!res) {
                replace({
                    regex: template.name,
                    replacement: targetPath,
                    paths: [targetPath],
                    recursive: true,
                    silent: true,
                });
                q.resolve();
              } else {
                console.error('Renaming template repo failed '.error);
                q.reject(res);
              }
            })
        } else {
          console.error(err);
          q.reject(err);
        }
    });

  return q.promise;
}

function getTemplatesList(){
  var q = Q.defer();
  request({uri: 'http://developer.mobilecaddy.net/cli-templates.php', json : true}, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      q.resolve(body);
    } else {
      console.error('Error retrieving known templates list\n'.error);
      console.error('These are the last known templates;');
      q.resolve(knownTemplates2);
    }
  });
  return q.promise;
}

function installNpmDeps(targetPath){
  var q = Q.defer();
  console.log('Installing project NPM dependancies (may take a few moments)...');
  cd(targetPath);
  var sudoStr = (os.platform() == "darwin" || argv.sudo) ? "sudo " : "";
  var child = exec(sudoStr + 'npm install', {async:true});
  child.stdout.on('data', function(data) {
    console.log('data: ' + data);
    q.resolve();
  });
  cd('..');
  return q.promise;
}


function installBowerDeps(targetPath){
  var q = Q.defer();
  console.log('Installing project bower dependancies (may take a few moments)...');
  var child = exec('bower install', function(code, output) {
    q.resolve();
  });
  return q.promise;
}


function runInitGruntTask(targetPath){
  var q = Q.defer();
  console.log('Running initial grunt tasks...');
  var child = exec('grunt devsetup', function(code, output) {
    q.resolve();
  });
  return q.promise;
}