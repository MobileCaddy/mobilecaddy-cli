mobilecaddy-cli
===

CLI tools for MobileCaddy.

## Installation

`$ npm install -g mobilecaddy`

## Usage

### List available templates

```
mobilecaddy templates
```

### Create a new project from a template

```
mobilecaddy new <template|git-zip-url> <your-app-name> [--sudo]
```

Supplying *--sudo* flag will run *npm install* commands with sudo (auto on Mac OS)

### Start your app in a local web server

```
mobilecaddy serve [options]

## options:
## --local								# run against local mock data rather than SFDC
## --scrub=[true | full]	# Clears local data ('full'=inc oauth)
## --rec									# Record SFDC responses and populate 'mock' files
```

