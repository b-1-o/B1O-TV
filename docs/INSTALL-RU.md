# B1O TV — полная инструкция по установке на Samsung Smart TV

## Что это за архив

Архив **B1O-TV-TV-Project.zip** — готовая production web-сборка приложения. В корне архива должны лежать `index.html`, `config.xml`, `icon.png`, `icon.svg`, каталог `assets/` и эта инструкция. Логотип интерфейса берётся из `assets/logo.jpg`; для Samsung TV CI создаёт квадратный PNG launcher icon на основе этого логотипа.

**Это не подписанный файл `.wgt`.** Samsung Tizen требует подписать приложение сертификатом, подходящим для твоего устройства. Я не могу подписать пакет твоим сертификатом, которого нет в репозитории. Поэтому один раз нужно подготовить проект в Tizen Studio и установить его через сеть; после этого приложение появится среди установленных приложений телевизора. Samsung указывает, что приложения для TV устанавливаются как `.wgt` и подписываются действующим сертификатом. См. [Samsung TV SDK FAQ](https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html?device=htv) и [CLI guide](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html?device=htv).

## Часть 1. Подготовить компьютер

### 1. Скачать нужные инструменты

Открой официальные страницы Samsung:

- [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download?langredirect=1) — среда разработки.
- [Samsung TV Extension download](https://developer.samsung.com/smarttv/develop/tools/tv-extension/download.html?device=htv) — расширение для телевизоров.
- [Installing the TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html) — официальные шаги установки.

Установи Tizen Studio, запусти **Package Manager** и поставь **Samsung TV Extension / TV Extensions Tools** и **Samsung Certificate Extension**. Используй свежую Certificate Extension: Samsung предупреждает, что создание сертификатов в версиях ниже 2.0.73 не поддерживается после сентября 2025 года.

**Если твой компьютер работает на CachyOS:** официальный пакет Samsung TV Extension публикуется, в частности, для Ubuntu 64-bit, Windows 64-bit и macOS, но не для Arch/CachyOS. Инструменты могут потребовать отсутствующие системные библиотеки. Если Tizen Studio не запускается на CachyOS, используй поддерживаемый Windows- или Ubuntu-компьютер/окружение, а не пытайся обходить ошибки случайными библиотеками. Сам архив B1O TV от этого не зависит.

### 2. Создать сертификат Samsung TV

1. Зарегистрируйся/войди в [Samsung Developer](https://developer.samsung.com/).
2. В Tizen Studio открой **Tools → Certificate Manager**.
3. Нажми **+ → Samsung → TV** и создай профиль сертификатов.
4. Создай Author certificate и Distributor certificate, выбрав свой телевизор/его Device ID (DUID), когда мастер этого потребует.
5. Сохрани пароль и резервную копию сертификата в безопасном месте. Не клади сертификаты и пароли в GitHub и не отправляй их вместе с ZIP.

Для будущего обновления установленного приложения сохрани исходный Author certificate: обновления должны быть подписаны тем же авторским сертификатом. Официальная инструкция: [Creating Certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html).

## Часть 2. Включить Developer Mode на телевизоре

Для Samsung QLED Q60D путь может немного различаться в зависимости от версии Tizen, но у актуальных Samsung TV обычно используется такой порядок:

1. Подключи компьютер и телевизор к одной домашней сети. Для первой настройки предпочтительнее обычный LAN/Wi‑Fi адрес компьютера, например `192.168.1.72`, а не Tailscale-адрес `100.x.x.x`.
2. На телевизоре нажми **Home → Apps**.
3. Открой **Apps Settings** (значок настроек на странице приложений).
4. На экранной цифровой клавиатуре введи `12345`. Если физического цифрового пульта нет, используй клавиатуру на экране.
5. В окне Developer Mode переключи **Developer mode → On**.
6. В поле IP address введи локальный IPv4 компьютера, на котором установлен Tizen Studio.
7. Нажми **OK** и перезагрузи телевизор.

Это официальный порядок Samsung: [TV Device — Developer Mode and connection](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html).

Чтобы узнать правильный адрес компьютера, посмотри вывод `npm run dev` или настройки сети. Используй адрес, с которого телевизор может достучаться до компьютера в той же сети. Если адрес компьютера поменяется, обнови IP в Developer Mode и перезагрузи TV.

## Часть 3. Распаковать проект и собрать WGT

### 1. Скачать и распаковать B1O TV

1. Скачай **B1O-TV-TV-Project.zip**.
2. Распакуй его в обычную папку, например `B1O-TV-TV-Project/`.
3. Убедись, что `index.html`, `config.xml` и `icon.png` находятся прямо в корне распакованной папки, а рядом есть каталог `assets/`. **Не перемещай только index.html отдельно** — файлы JS, CSS и изображения лежат в `assets/`.

### 2. Создать проект Tizen Studio

1. Открой Tizen Studio.
2. Выбери **File → New → Tizen Project**.
3. Создай проект для **TV / Web Application**. В некоторых версиях мастера шаблоны сгруппированы под **Template** или **Sample**; выбирай именно телевизионное Web Application, а не Mobile и не Native.
4. Назови проект, например `B1Otv`, и создай его.
5. В Project Explorer открой папку проекта. Скопируй содержимое распакованного B1O TV ZIP в корень Tizen-проекта, подтвердив замену файлов. Сохрани служебные файлы проекта, созданные Tizen Studio.

### 3. Проверить манифест перед сборкой

Открой проектный `config.xml`. Убедись, что рядом с `index.html` действительно лежит `icon.png`, а запись значка выглядит так:

```xml
<icon src="icon.png" />
```

В манифесте B1O TV указан постоянный идентификатор:

```xml
<tizen:application id="B1Otv00001.B1web" package="B1Otv00001" required_version="5.5" />
```

Не редактируй эти ID наугад. Если мастер Tizen Studio сгенерировал другие значения или предупреждает о несовпадении идентификаторов, проверь настройки Application ID/Package ID в редакторе `config.xml` и используй согласованные значения. Идентификатор должен оставаться тем же при дальнейших обновлениях приложения.

### 4. Подключить телевизор в Tizen Studio

1. Убедись, что Developer Mode всё ещё включён и TV перезагружен.
2. В Tizen Studio открой **Tools → Device Manager**.
3. Открой **Remote Device Manager**, нажми **+** и добавь телевизор по его IP-адресу. Если поле порта требуется вручную, используй стандартный порт SDB для TV `26101`, если в твоём SDK/устройстве не указан другой.
4. Включи переключатель **Connection**.
5. Если установка запрещена, щёлкни правой кнопкой мыши по подключённому устройству и выбери **Permit to install applications**.

Официальные шаги подключения описаны в [TV Device](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html) и [CLI guide](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html?device=htv).

### 5. Установить приложение на TV

**Самый простой вариант — прямо из Tizen Studio:**

1. Проверь, что в Certificate Manager выбран созданный Samsung TV certificate profile.
2. В Project Explorer щёлкни правой кнопкой по проекту.
3. Выбери **Run As → Tizen Web Application**. Tizen Studio соберёт/подпишет приложение, отправит его по сети и запустит на подключённом телевизоре.
4. Если хочешь отдельно сохранить установочный пакет, используй действие **Build Package** для Tizen Web Application; результатом будет файл `.wgt`. Устанавливай его через Tizen Studio/Device Manager.

**Не пытайся просто скопировать `.wgt` на USB и открыть его на телевизоре:** обычная установка WGT через USB на Samsung Smart TV не поддерживается; используй подключение Tizen Studio по сети. См. [Samsung installation FAQ](https://developer.samsung.com/smarttv/develop/faq/application-installation.html?device=htv).

После успешной установки отключать Developer Mode не требуется для самой работы приложения. Запусти B1O TV из списка Apps. Приложение не заменяет системный Home и не запускается автоматически при включении телевизора.

## Часть 4. Настроить B1O TV на компьютере и перенести настройки

### 1. Настроить на ПК

1. Запусти локальный предпросмотр B1O TV на компьютере.
2. Открой его по LAN-адресу, например `http://192.168.1.72:5173/`. Используй фактический адрес, который показывает Vite в терминале; адрес может измениться после переподключения к сети. Tailscale URL `100.x.x.x` сработает на телевизоре только если телевизор имеет доступ к этой сети.
3. Открой **Settings** и настрой:
   - **Weather** — City и Fahrenheit/Celsius.
   - **Appearance** — обои и Reduce motion.
   - **Media Services** — Jellyfin URL и SelfMusic URL.
   - **AI & Voice** — AI backend endpoint и device token.
4. Для AI endpoint используй HTTPS-адрес твоего B1O TV Worker. Device token должен совпадать с секретом `ASSISTANT_TOKEN`, установленным в Cloudflare Worker. Это токен доступа к Worker, не API-ключ модели.
5. Нажми **Export TV Setup**. Браузер скачает `b1o-tv-setup.json`.

### 2. Перенести настройки на телевизор

1. Запусти установленное B1O TV.
2. Открой **Settings → PC → TV Setup → Import TV Setup** (карточка находится внизу страницы настроек).
3. Выбери созданный файл `b1o-tv-setup.json`.
4. Проверь, что город, единицы температуры, обои и адреса сервиса появились в настройках. Настройки сохраняются автоматически.

**Безопасность:** экспортированный JSON содержит device token. Не отправляй его другим людям, не загружай в публичные чаты, не коммить в GitHub. После импорта можешь удалить копию с компьютера, если она больше не нужна.

Если файловый выбор в версии браузера Tizen на твоём телевизоре не открывается или не позволяет выбрать JSON, введи нужные значения непосредственно на TV в Settings. Поддержка диалогов выбора локальных файлов зависит от конкретной версии Tizen; это нужно проверить на устройстве. Русский текстовый ввод в ассистент поддерживается через backend, а диктовка по микрофону дополнительно зависит от наличия Speech Recognition API в прошивке.

## Устранение неполадок

- **Установка не проходит / Error 205:** проверь Certificate Manager, выбери корректный Samsung TV certificate profile и пересобери WGT. Не редактируй пакет после подписи.
- **Error 118 / package install failed:** перепроверь Device Manager, разрешение **Permit to install applications**, Tizen profile, Application ID/Package ID и сертификат.
- **ТВ не виден в Device Manager:** проверь Developer Mode и IP; компьютер и телевизор должны быть в одной сети. Перезапусти устройство и попробуй повторно подключиться.
- **Нет погоды:** проверь подключение к интернету и имя города в Settings.
- **AI отвечает ошибкой 401/503:** токен устройства должен совпадать с `ASSISTANT_TOKEN` на Worker; проверь, что Worker опубликован и URL содержит правильный endpoint.
- **Jellyfin/SelfMusic не открываются:** проверь URL на другом устройстве. Для TV также могут потребоваться разрешённые сетевые домены в `config.xml`; добавляй только origin своего сервера.
- **Голосовой ввод не работает:** сначала проверь текстовый чат. Поддержка микрофона и Speech Recognition зависит от прошивки; сама кнопка микрофона пульта может быть зарезервирована системой.

## Официальные ссылки Samsung

- [Download Tizen Studio](https://developer.tizen.org/development/tizen-studio/download?langredirect=1)
- [Samsung TV Extension](https://developer.samsung.com/smarttv/develop/tools/tv-extension/download.html?device=htv)
- [Create Samsung TV certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html)
- [Enable Developer Mode and connect to TV](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)
- [Application installation FAQ](https://developer.samsung.com/smarttv/develop/faq/application-installation.html?device=htv)
