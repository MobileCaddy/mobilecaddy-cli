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
mobilecaddy new <template-name> <your-app-name>
```

### Start your app in a local web server

```
mobilecaddy serve [options]

## options:
## --local								# run against local mock data rather than SFDC
## --scrub=[true | full]	# Clears local data ('full'=inc oauth)
## --rec									# Record SFDC responses and populate 'mock' files
```

