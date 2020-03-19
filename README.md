# homebase

`homebase` is a self-deployable tool for managing websites published with the [Dat protocol](https://datprotocol.com).

`homebase` is for you if:

- You're comfortable with some server administration (or want to learn!)
- You want to keep your dat:// website/s online
- You want to publish your dat:// website/s to a domain name

Don't want to run `homebase` yourself? You can still make sure your dat:// website stays online by using a service like [Hashbase](https://hashbase.io). Or maybe you can convince a generous friend to run an instance of `homebase` using its built-in [Pinning Service APIs](#example-seed-multiple-websites-enable-web-api).

## Table of contents

- [Features](#features)
- [Install](#install)
- [Running homebase](#running-homebase)
- [Examples](#examples)
- [Configuration](#configuration)
- [Advanced examples](#advanced-examples)
- [Troubleshooting](#troubleshooting)
- [Support](#support)
- [Web API Clients](#web-api-clients)
- [Changelog](#changelog)

## Features

- Keeps dat:// websites online
- Publishes dat:// websites to DNS shortnames
- Mirrors dat:// websites to https://
- Provisions and manages HTTPS with [Let's Encrypt](https://letsencrypt.org)
- Provides optional [Pinning Service API](https://www.datprotocol.com/deps/0003-http-pinning-service-api/) endpoints

## Install

If you already have [Node.js](https://nodejs.org) (8.0+) and [npm](https://npmjs.com) installed on your server, get started by installing Homebase with npm or [npx](https://github.com/zkat/npx).

```bash
npm install -g @beaker/homebase
```

Otherwise, install Node.js and npm first:

- [Install Node.js](https://nodejs.org/en/download/)
- [nvm](https://github.com/creationix/nvm) for managing Node versions
- [Fixing npm permissions problems](https://docs.npmjs.com/getting-started/fixing-npm-permissions)

Having trouble installing? See [Troubleshooting](#troubleshooting).

## Running homebase

To run `homebase` manually, simply invoke the `homebase` command:

```bash
homebase
```

To keep `homebase` running, you'll need to daemonize it. We like using [pm2](https://www.npmjs.com/package/pm2).

```bash
# install pm2
npm i -g pm2

# start homebase with pm2
pm2 start homebase
```

To stop the daemon, run:

```
# stop homebase
pm2 stop homebase
```

### Command line flags

- `--config <path>`
  - Use the config file at the given path instead of the default `~/.homebase.yml`. Overrides the value of the HOMEBASE_CONFIG env var.

### Environment variables

- `HOMEBASE_CONFIG=cfg_file_path`
  - Specify an alternative path to the config than `~/.homebase.yml`
- `NODE_ENV=debug|staging|production`
  - Set to debug or staging to use the Let's Encrypt testing servers.

## Examples

`homebase` uses a [configuration file](#configuration-file) (`~/.homebase.yml` by default) for managing its behavior. These examples show various configurations.

[See all configuration options](#configuration)

### Example: set up a website with a domain name and HTTP mirroring

This configuration file will "seed" or "pin" the files at `dat://123...456`, publish those files to `dat://alice.com`, and mirror them to `https://alice.com`.

This example uses a domain name, so in order for the domain name to resolve correctly, you'll need to update your DNS configuration first. In this case, you could set an `A` record that points to the `homebase` server's IP address.

```yaml
dats:
  - url: dat://123...456
    domains:
      - alice.com
httpMirror: true
letsencrypt:
  email: alice@mail.com
  agreeTos: true

```

### Example: seed multiple websites, with no domain names

This configuration simply "seeds" or "pins" the files at `dat://123...456` and `dat:///456...789`. No domain name is required for this configuration.

```yaml
dats:
  - url: dat://123...456
  - url: dat://456...789
```

### Example: seed multiple websites, enable Web API

In addition to being used to manage a website, `homebase` can be used with more specific configurations, like providing a mini-pinning service for a group of friends.

This example enables the [Pinning Service API](https://www.datprotocol.com/deps/0003-http-pinning-service-api/), which makes it possible for you (and maybe a few friends!) to publish to your `homebase` instance with the [Dat CLI](https://npm.im/dat), or any client that supports the Pinning Service API. There are plans to support publishing from within [Beaker](https://beakerbrowser.com) in the future.

If you choose to use a domain name for your API endpoint, be sure to configure your DNS to point to your `homebase` server.

[See full `webapi` reference](#webapi)

```yaml
# enable publishing to `homebase` from Beaker and the Dat CLI
webapi:                # set to false to disable
  domain:              # the domain name for the web API (optional)
  username:            # the username for publishing from Beaker or the Dat CLI
  password:            # the password for publishing from Beaker or the Dat CLI
```

## Configuration

- [Configuration file](#configuration-file)
- [dashboard](#dashboard)
  - [dashboard.port](#dashboardport)
- [dats](#dats)
  - [dats.*.url](#datsurl)
  - [dats.*.domains](#datsdomains)
  - [dats.*.name](#datsname)
  - [dats.*.otherDomains](#datsotherdomains)
- [directory](#directory)
- [domain](#domain)
- [httpMirror](#httpmirror)
- [letsencrypt](#letsencrypt)
  - [letsencrypt.email](#letsencryptemail)
  - [letsencrypt.agreeTos](#letsencryptagreetos)
- [ports](#ports)
  - [ports.http](#portshttp)
  - [ports.https](#portshttps)
- [proxies](#proxies)
  - [proxies.*.from](#proxiesfrom)
  - [proxies.*.to](#proxiesto)
- [redirects](#redirects)
  - [redirects.*.from](#redirectsfrom)
  - [redirects.*.to](#redirectsto)
- [webapi](#webapi)
  - [webapi.username](#webapiusername)
  - [webapi.password](#webapipassword)
  - [webapi.domain](#webapidomain)

### Configuration file

`homebase` uses `~/.homebase.yml` as its default configuration file. You can specify an alternative config file using a [command line flag](#command-line-flags) or an [environment variable](#environment-variables).


```yaml
directory: ~/.homebase # where your data will be stored
httpMirror: true       # enables HTTP mirroring
ports:
  http: 80             # HTTP port for redirects or non-TLS serving
  https: 443           # HTTPS port for serving mirrored content and DNS data
letsencrypt:           # set to false to disable Let's Encrypt
  email:               # you must provide your email to LE for admin
  agreeTos: true       # you must agree to the LE terms (set to true)
dashboard:             # set to false to disable
  port: 8089           # port for accessing the metrics dashboard

# enable publishing to homebase from Beaker and the Dat CLI
webapi:                # set to false to disable
  domain:              # enter your web API's domain here (optional, unless Let's Encrypt TLS is wanted on the web API)
  username:            # the username for publishing from Beaker or the Dat CLI
  password:            # the password for publishing from Beaker or the Dat CLI

# enter your pinned dats here
dats:
  - url:               # URL of the dat to be pinned
    domains:           # (optional) the domains of the dat

# enter any proxied routes here
proxies:
  - from:              # the domain to accept requests from
    to:                # the domain (& port) to target

# enter any redirect routes here
redirects:
  - from:              # the domain to accept requests from
    to:                # the domain to redirect to
```

### dashboard

Default `false`

Set to `true` to enable the [Prometheus metrics dashboard](#example-using-a-metrics-dashboard).

```yaml
dashboard:             # set to false to disable
  port: 8089           # port for accessing the metrics dashboard
```

#### dashboard.port

Default: `8089`

The port to serve the [Prometheus metrics dashboard](#example-using-a-metrics-dashboard).

### dats

A listing of the Dat archives to seed.

```yaml
dats:
  - url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    domains:
      - mysite.com
      - my-site.com
```

#### dats.*.url

The Dat URL of the site to host. Should be a 'raw' dat url (no DNS hostname).

Example values:

```
# raw key
1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03

# URL with trailing slash
dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/

# URL with no trailing slash
dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03
```

#### dats.*.domains

Additional domains of the Dat archive. Can be a string or a list of strings. Each string should be a domain name.

To use `dats.*.domains`, you'll first need to configure the DNS entry for your domain name to point to your server. For instance, to point `alice.com` with `homebase`, you'll need to update your DNS configuration to point `alice.com` to your homebase server's IP address.

Example values:

```
mysite.com
foo.bar.edu
best-site-ever.link
```

#### dats.*.name

**DEPRECATED**. See the [v2.0.0 migration guide](#migrating-to-v2-0-0).

The name of the Dat archive. Sets a subdomain relative to the Web API domain, similar to the way that [Hashbase](https://hashbase.io) does. Must be unique on the `homebase` instance.

#### dats.*.otherDomains

**DEPRECATED**. Use the [domains field](#dats-domains) instead.

Additional domains of the Dat archive. Can be a string or a list of strings. Each string should be a domain name. Example values:

```
mysite.com
foo.bar.edu
best-site-ever.link
```

### directory

Default:  `~/.homebase`

The directory where `homebase` will store your Dat archive's files.

### domain

**DEPRECATED**. See the [v2.0.0 migration guide](#migrating-to-v2-0-0).

The DNS domain of your homebase instance.

### httpMirror

Default: `false`

Set to `true` to provide https mirroring of your Dat archives.

### letsencrypt

Default: `false`

Set to `true` to enable Lets Encrypt's automatic TLS certificate provisioning.

```yaml
letsencrypt:           # set to false to disable Let's Encrypt
  email:               # you must provide your email to LE for admin
  agreeTos: true       # you must agree to the LE terms (set to true)
```

#### letsencrypt.email

The email to send Let's Encrypt notices to.

#### letsencrypt.agreeTos

Do you agree to the [terms of service of Lets Encrypt](https://letsencrypt.org/repository/)? Required, must be true.

### ports

The ports for HTTP and HTTPS.

```yaml
ports:
  http: 80             # HTTP port for redirects or non-TLS serving
  https: 443           # HTTPS port for serving mirrored content and DNS data
```

#### ports.http

Default: `80`

The port for serving HTTP sites.

HTTP automatically redirects to HTTPS.

#### ports.https

Default: `443`

The port for serving HTTPS sites.

### proxies

A listing of domains to proxy. Useful when your server has other services running that you need available.

```yaml
proxies:
  - from: my-proxy.com
    to: http://localhost:8080
```

#### proxies.*.from

The domain to proxy from. Should be a domain name.

Example values:

```
mysite.com
foo.bar.edu
best-site-ever.link
```

#### proxies.*.to

The protocol, domain, and port to proxy to. Should be an [origin](https://en.wikipedia.org/wiki/Same-origin_policy#Origin_determination_rules).

Example values:

```
https://mysite.com/
http://localhost:8080/
http://127.0.0.1:123/
```

### redirects

A listing of domains to redirect.

```yaml
redirects:
  - from: my-old-site.com
    to: https://my-site.com
```

#### redirects.*.from

The domain to redirect from. Should be a domain name.

Example values:

```
mysite.com
foo.bar.edu
best-site-ever.link
```

#### redirects.*.to

The base URL to redirect to. Should be an [origin](https://en.wikipedia.org/wiki/Same-origin_policy#Origin_determination_rules).

Example values:

```
https://mysite.com/
http://localhost:8080/
http://127.0.0.1:123/
```

### webapi

Default: `false`

Set to `true` to enable the [Pinning Service API](https://www.datprotocol.com/deps/0003-http-pinning-service-api/), which enables publishing to Homebase with [Beaker](https://beakerbrowser.com), the [Dat CLI](https://npm.im/dat), or any other client that supports the Pinning Service API.

```yaml
# enable publishing to `homebase` from Beaker and the Dat CLI
webapi:                # set to false to disable
  domain:              # the domain of the web api (optional)
  username:            # the username for publishing from Beaker or the Dat CLI
  password:            # the password for publishing from Beaker or the Dat CLI
```

#### webapi.username

The username for your pinning service API.

#### webapi.password

The password for your pinning service API.

#### webapi.domain

The DNS domain of your homebase Web API. Optional, but required if you want Let's Encrypt to provide your Web API with a TLS certificate.

## Advanced examples

### Example: proxies

If your `homebase` instance is running on ports 80/443, and you have other Web servers running on your server, you might need `homebase` to proxy to those other servers. You can do that with the `proxies` config. Here's an example proxy rule:

[See full `proxies` reference](#proxies)

```yaml
proxies:
  - from: my-proxy.com
    to: http://localhost:8080
```

### Example: redirecting requests

Sometimes you need to redirect old domains to new ones. You can do that with the `redirects` rule. Here's an example redirect rule:

[See full `redirects` reference](#redirects)

```yaml
redirects:
  - from: my-old-site.com
    to: https://my-site.com
```

### Example: using a metrics dashboard

`homebase` has built-in support for [Prometheus](https://prometheus.io), which can be visualized with [Grafana](http://grafana.org/).

![./grafana-screenshot.png](./grafana-screenshot.png)

Homebase exposes its metrics at port 8089. Prometheus periodically scrapes the metrics and stores them in a database. Grafana uses those metrics and provides a provides a nice dashboard visualization. It's a little daunting at first, but setup should be relatively painless.

Steps:

 1. [Install Prometheus](https://prometheus.io/download/) on your server
 2. [Install Grafana](http://grafana.org/download/) on your server
 3. Update the `prometheus.yml` config
 4. Start Prometheus and Grafana
 5. Login to Grafana
 6. Add Prometheus as a data source to Grafana (it should be running at `localhost:9090`
 7. Import [this Grafana dashboard](./grafana-dashboard.json)

Your `prometheus.yml` config should include have the `scrape_configs` option set like this:

```yaml
scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'homebase'
    static_configs:
      - targets: ['localhost:8089']
```

### Example: running homebase behind Apache or Nginx

If you're running `homebase` on a server that uses Apache or Nginx, you may need to change your config to disable HTTPS. For instance, if you're using nginx and proxying to port `8080`, update your config to disable Let's Encrypt and to set the HTTP port:

```yaml
letsencrypt: false
ports:
  http: 8080
```

You will need to add all domains to your Nginx/Apache config.

### Example: running homebase in a docker container

1. Install [Docker](http://docker.com/). If you're on Linux, remember to [configure Docker to start on boot](https://docs.docker.com/install/linux/linux-postinstall/). Don't know of the equivalent for other systems.

2. Clone the project. Edit `.homebase.yml` according to your needs. Most importantly: **Change username and password**.  
If you don't want to think of a username and a password, just use [this](https://stackoverflow.com/a/1349426/6690391) but **increase the length**.

3. In the project root, run this command:

```
docker build -t homebase:latest . && docker run -d --name=homebase --restart=always -p 80:80 -p 443:443 -p 3282:3282 homebase:latest
```

**Notes:**  
1. Not an expert in Docker security or configuration.  
2. if you have Beaker on the same machine, you may want to change the dat port `-p 3282:3282` to something like `-p 9999:3282`.  
3. To debug the running container:
   - Run `docker ps -a` to see the container running status.  
   - Run `docker logs homebase` to see the logs.
   - Run `docker exec -it homebase sh` to get into a terminal.
4. Didn't think about how you'd install a newer version of homebase while keeping the old configuration and data.

## Troubleshooting

### Installing build dependencies

When installing `homebase`, you may need to install additional build dependencies:

```
sudo apt-get install libtool m4 automake libcap2-bin build-essential
```

### Port setup (EACCES error)

For `homebase` to work correctly, you need to be able to access port 80 (http), 443 (https), and 3282 (dat). Your firewall should be configured to allow traffic on those ports.

If you get an EACCES error on startup, you either have a process using the port already, or you lack permission to use the port. Try `lsof -i tcp:80` or `lsof -i tcp:443` to see if there are any processes bound to the ports you need.

If the ports are not in use, then it's probably a permissions problem. We recommend using the following command to solve that:

```
# give node perms to use ports 80 and 443
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``
```

This will give nodejs the rights to use ports 80 and 443. This is preferable to running homebase as root, because that carries some risk of a bug in `homebase` allowing somebody to control your server.

## Support

`homebase` is built by the [Beaker Browser team](https://beakerbrowser.com/about). Become a backer and help support the development of an open, friendly, and fun Web. You can help us continue our work on Beaker, [hashbase.io](https://hashbase.io), `homebase`, and more. Thank you!

[Become a backer](https://opencollective.com/beaker)

<a href="https://opencollective.com/beaker/backer/0/website" target="_blank"><img src="https://opencollective.com/beaker/backer/0/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/1/website" target="_blank"><img src="https://opencollective.com/beaker/backer/1/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/2/website" target="_blank"><img src="https://opencollective.com/beaker/backer/2/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/3/website" target="_blank"><img src="https://opencollective.com/beaker/backer/3/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/4/website" target="_blank"><img src="https://opencollective.com/beaker/backer/4/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/5/website" target="_blank"><img src="https://opencollective.com/beaker/backer/5/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/6/website" target="_blank"><img src="https://opencollective.com/beaker/backer/6/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/7/website" target="_blank"><img src="https://opencollective.com/beaker/backer/7/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/8/website" target="_blank"><img src="https://opencollective.com/beaker/backer/8/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/9/website" target="_blank"><img src="https://opencollective.com/beaker/backer/9/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/10/website" target="_blank"><img src="https://opencollective.com/beaker/backer/10/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/11/website" target="_blank"><img src="https://opencollective.com/beaker/backer/11/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/12/website" target="_blank"><img src="https://opencollective.com/beaker/backer/12/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/13/website" target="_blank"><img src="https://opencollective.com/beaker/backer/13/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/14/website" target="_blank"><img src="https://opencollective.com/beaker/backer/14/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/15/website" target="_blank"><img src="https://opencollective.com/beaker/backer/15/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/16/website" target="_blank"><img src="https://opencollective.com/beaker/backer/16/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/17/website" target="_blank"><img src="https://opencollective.com/beaker/backer/17/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/18/website" target="_blank"><img src="https://opencollective.com/beaker/backer/18/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/19/website" target="_blank"><img src="https://opencollective.com/beaker/backer/19/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/20/website" target="_blank"><img src="https://opencollective.com/beaker/backer/20/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/21/website" target="_blank"><img src="https://opencollective.com/beaker/backer/21/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/22/website" target="_blank"><img src="https://opencollective.com/beaker/backer/22/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/23/website" target="_blank"><img src="https://opencollective.com/beaker/backer/23/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/24/website" target="_blank"><img src="https://opencollective.com/beaker/backer/24/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/25/website" target="_blank"><img src="https://opencollective.com/beaker/backer/25/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/26/website" target="_blank"><img src="https://opencollective.com/beaker/backer/26/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/27/website" target="_blank"><img src="https://opencollective.com/beaker/backer/27/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/28/website" target="_blank"><img src="https://opencollective.com/beaker/backer/28/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/29/website" target="_blank"><img src="https://opencollective.com/beaker/backer/29/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/30/website" target="_blank"><img src="https://opencollective.com/beaker/backer/30/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/31/website" target="_blank"><img src="https://opencollective.com/beaker/backer/31/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/32/website" target="_blank"><img src="https://opencollective.com/beaker/backer/32/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/33/website" target="_blank"><img src="https://opencollective.com/beaker/backer/33/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/34/website" target="_blank"><img src="https://opencollective.com/beaker/backer/34/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/35/website" target="_blank"><img src="https://opencollective.com/beaker/backer/35/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/36/website" target="_blank"><img src="https://opencollective.com/beaker/backer/36/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/37/website" target="_blank"><img src="https://opencollective.com/beaker/backer/37/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/38/website" target="_blank"><img src="https://opencollective.com/beaker/backer/38/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/39/website" target="_blank"><img src="https://opencollective.com/beaker/backer/39/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/40/website" target="_blank"><img src="https://opencollective.com/beaker/backer/40/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/41/website" target="_blank"><img src="https://opencollective.com/beaker/backer/41/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/42/website" target="_blank"><img src="https://opencollective.com/beaker/backer/42/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/43/website" target="_blank"><img src="https://opencollective.com/beaker/backer/43/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/44/website" target="_blank"><img src="https://opencollective.com/beaker/backer/44/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/45/website" target="_blank"><img src="https://opencollective.com/beaker/backer/45/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/46/website" target="_blank"><img src="https://opencollective.com/beaker/backer/46/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/47/website" target="_blank"><img src="https://opencollective.com/beaker/backer/47/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/48/website" target="_blank"><img src="https://opencollective.com/beaker/backer/48/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/49/website" target="_blank"><img src="https://opencollective.com/beaker/backer/49/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/50/website" target="_blank"><img src="https://opencollective.com/beaker/backer/50/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/51/website" target="_blank"><img src="https://opencollective.com/beaker/backer/51/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/52/website" target="_blank"><img src="https://opencollective.com/beaker/backer/52/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/53/website" target="_blank"><img src="https://opencollective.com/beaker/backer/53/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/54/website" target="_blank"><img src="https://opencollective.com/beaker/backer/54/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/55/website" target="_blank"><img src="https://opencollective.com/beaker/backer/55/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/56/website" target="_blank"><img src="https://opencollective.com/beaker/backer/56/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/57/website" target="_blank"><img src="https://opencollective.com/beaker/backer/57/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/58/website" target="_blank"><img src="https://opencollective.com/beaker/backer/58/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/59/website" target="_blank"><img src="https://opencollective.com/beaker/backer/59/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/60/website" target="_blank"><img src="https://opencollective.com/beaker/backer/60/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/61/website" target="_blank"><img src="https://opencollective.com/beaker/backer/61/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/62/website" target="_blank"><img src="https://opencollective.com/beaker/backer/62/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/63/website" target="_blank"><img src="https://opencollective.com/beaker/backer/63/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/64/website" target="_blank"><img src="https://opencollective.com/beaker/backer/64/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/65/website" target="_blank"><img src="https://opencollective.com/beaker/backer/65/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/66/website" target="_blank"><img src="https://opencollective.com/beaker/backer/66/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/67/website" target="_blank"><img src="https://opencollective.com/beaker/backer/67/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/68/website" target="_blank"><img src="https://opencollective.com/beaker/backer/68/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/69/website" target="_blank"><img src="https://opencollective.com/beaker/backer/69/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/70/website" target="_blank"><img src="https://opencollective.com/beaker/backer/70/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/71/website" target="_blank"><img src="https://opencollective.com/beaker/backer/71/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/72/website" target="_blank"><img src="https://opencollective.com/beaker/backer/72/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/73/website" target="_blank"><img src="https://opencollective.com/beaker/backer/73/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/74/website" target="_blank"><img src="https://opencollective.com/beaker/backer/74/avatar.svg"/></a>  <a href="https://opencollective.com/beaker/backer/75/website" target="_blank"><img src="https://opencollective.com/beaker/backer/75/avatar.svg"/></a>

## Web API Clients

* [pyhomebase](https://github.com/datpy/pyhomebase)

## Changelog

### v2.0.0

 - Removed the `dats.*.name` field. You can now set the domains for your dats directly with the `dat.*.domains` field.
 - Moved the `domain` config from the top of the yaml file to the `webapi` field. This makes it clearer what the domain applies to. Optional, unless you want to use Let's Encrypt.

The original release of `homebase` tried to mimic [Hashbase](https://github.com/beakerbrowser/hashbase) as closely as possible. As a result, it had a concept of a root domain and each dat was given a `name` which became a subdomain under that root domain. This confused most users and was generally regarded as "the worst." To simplify the config process, we removed the concept of the root domain and `name` attribute. Now, you just set the domains directly on each dat.

#### Migrating to v2.0.0

If your previous config file looked like this:

```yaml
domain: foo.com
dats:
  - url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    name: mysite
    domains:
      - mysite.com
      - my-site.com
```

After migrating, it should look like this:

```yaml
dats:
  - url: dat://1f968afe867f06b0d344c11efc23591c7f8c5fb3b4ac938d6000f330f6ee2a03/
    domains:
      - mysite.foo.com
      - mysite.com
      - my-site.com
```

If you want to use the Web API at a domain, you should move the `domain` option to the `webapi` field. So, if your config file looked like this:

```yaml
domain: foo.com
webapi:
  username: admin
  password: hunter2
```

It should be updated to look like this:

```yaml
webapi:
  domain: foo.com
  username: admin
  password: hunter2
```
