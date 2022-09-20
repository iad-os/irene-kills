<p align="center"> 
  <img src="logo.png" alt="IK-logo" width="250px" height="250px">
</p>
<h1 align="center">Welcome to @iad-os/irene-kills 👋</h1>
<p>
  <a href="https://www.npmjs.com/package/@iad-os/irene-kills" target="_blank">

  <img alt="Version" src="https://img.shields.io/npm/v/@iad-os/irene-kills.svg">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D%2016.13%20%3C17-blue.svg" />
  <a href="#" target="_blank">
  <img alt="License: Apache--2.0" src="https://img.shields.io/badge/License-Apache--2.0-yellow.svg" />

  </a>
</p>

> Yes ... only if necessary, but ... Irene Kills!

## Table of content

- [Table of content](#table-of-content)
- [📝 About The Project](#-about-the-project)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Usage](#usage)
- [Run tests](#run-tests)
- [Author](#author)
- [Contributors](#contributors)
- [Show your support](#show-your-support)
- [License](#license)

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

<!-- ABOUT THE PROJECT -->

## 📝 About The Project

<p align="justify"> 
Irene Kills is a library written in TypeScript that allows you to easily manage the application life-cycle.
We created this library to build applications that respect cloud native principles and to find a standard and tested way to manage the life cycle of our microservices.

**_IK - goals_**
It allows you to create applications that are resilient, able to detect changes in the system, detect errors and react accordingly, for example by killing itself or going into a sick state.

Ensures that when the application is in a "healthy" state it is actually ready to respond.
If an error occurs in the system that could affect the operation of the application, the application will notice the change and change its status.

</p>

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## Prerequisites

- node >= 16.13 <17

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## Install

```sh
npm install @iad-os/irene-kills
```

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## Usage

Instantiate and configure examples:

```TypeScript
import { IreneKills } from '@iad-os/irene-kills';
import { introspectCredentials } from '../main-auth';
import * as dbService from '../main-db';
import * as apiService from '../main-http';
import log from '../config/log';

const irene = new IreneKills({ logger: log({ tags: ['ik'] }) });

irene.resource<{ logger: ReturnType<typeof log> }>('database', {
  value: { logger: log({ tags: ['db'] }) },
  need: async ({ value: { logger } }) => {
    logger.info('⏳ initialize db connection');
    await dbService.start();
    return { logger };
  },
  check: async ({ value: { logger } }) => {
    try {
      await dbService.checkDb();
      logger.info('✅ OK check db connection');
      return true;
    } catch (err) {
      logger.error({ error: err }, '💥 KO check db connection');
      return false;
    }
  },

  on: {
    healthcheck: async () => {
      await dbService.checkDb();
      return { healthy: true, kill: false };
    },
  },
});

irene.resource('http', {
  activate: async () => {
    try {
      await apiService.start();
      log({ tags: ['server'] }).info('✅ Application started');
      return { kill: false, healthy: true };
    } catch (err) {
      return { kill: true, healthy: false };
    }
  },
});

irene.resource<{ logger: ReturnType<typeof log> }>('oidc', {
  value: { logger: log({ tags: ['odic'] }) },
  check: async ({ value: { logger } }) => {
    try {
      await introspectCredentials();
      logger.info(`✅ OK Credentials`);
      return true;
    } catch (error) {
      logger.error(error, `💥 KO Credentials`);
      return false;
    }
  },
});

export default irene;
```

Wake up Irene in `main.ts`:

```TypeScript
irene
  .wakeUp()
  .finally(() =>
    log({ tags: ['wakeup', 'application', 'status'] }).info(
      `⚙️  APPLICATION STATUS -> ${irene.mood()}`
    )
  );

```

Current application status:

```TypeScript
irene.mood()
```
Trigger healthcheck:
```TypeScript
irene.healthcheck();
```
For more examples check under `__test__` folder.

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## Run tests

```sh
npm run test
```

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## Author

👤 **Daniele Fiungo <daniele.fiungo@iad2.it>**

- Github: [@danielefiungo](https://github.com/danielefiungo)

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## Contributors

<!--contributor image generated with https://contrib.rocks -->

<a href="https://github.com/iad-os/irene-kills/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=iad-os/irene-kills" />
</a>

## Show your support

Give a ⭐️ if this project helped you!

![-----------------------------------------------------](https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png)

## License

Licensed under the APLv2. See the [LICENSE](https://github.com/iad-os/irene-kills/blob/main/LICENSE) file for details.

Made with ❤️ by IAD
