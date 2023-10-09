(function () {
    const MAX_NAME_LENGTH = 15;
    // enable for 3g
    const MAX_INTERVAL_ATTEMPT = 100;
    const INTERVAL_TIME = 100; //ms

    const GROWTH_X_PASTE_NAME_BUTTON_CLASS = {
        FULL: "nameInserter-paste-name-button",
        SHORT: "nameInserter-paste-name-button-icon",
    };

    const GROWTH_X_PASTE_NAME_BUTTON_ID = {
        FULL_TWEET: "nameInserter-paste-name-button_tweet_id",
        FULL_MODAL: "nameInserter-paste-name-button_modal_id",
        SHORT: "nameInserter-paste-name-button-icon_id",
    };

    const TWEET_REPLY_BUTTON_TEST_ID = {
        // used for reply in modal
        TWEET_BUTTON: "[data-testid='tweetButton']",
        // used for reply under the tweet
        INLINE_TWEET_BUTTON: "[data-testid='tweetButtonInline']",
        // used for reply in DM and bottom drawer
        DM_SEND_BUTTON: "[data-testid='dmComposerSendButton']",
    };

    const TWITTER_SELECTOR = {
        TEST_ID_USER_NAME: "[data-testid='User-Name']",
        TEST_ID_TWEET_TEXTAREA: "[data-testid='tweetTextarea_0']",
        TEST_ID_DM_COMPOSER_TEXT_INPUT: "[data-testid='dmComposerTextInput']",
        ARIA_MODAL: "[aria-modal='true']",
        TEST_ID_TOOLBAR: "[data-testid='toolBar']",
        TEST_ID_DM_SCROLLER_CONTAINER: "[data-testid='DmScrollerContainer']",
        TEST_ID_USER_AVATAR_CONTAINER_UNKNOWN: "[data-testid='UserAvatar-Container-unknown']",
        ID_DETAIL_HEADER: "detail-header",
        TEST_ID_DM_DRAWER: "[data-testid='DMDrawer']",
        TEST_ID_DM_DRAWER_HEADER: "[data-testid='DMDrawerHeader']",
    }

    const OBSERVE_CONFIG = { subtree: true, childList: true };

    const PARTIAL_TWEET_URLS = {
        OPEN_MODAL: "/compose/tweet",
        TWEET_PAGE: "status",
        MESSAGES: "messages",
    }

    let currentUserName = null;

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function getFirstName() {
        if (typeof currentUserName === 'string' && currentUserName.length > 0) {
            return capitalizeFirstLetter(currentUserName.split(' ')[0]?.trim());
        }
    }

    function truncateName(name) {
        if (name.length > MAX_NAME_LENGTH) {
            return `${name.substring(0, MAX_NAME_LENGTH)}...`;
        }
        return name;
    }

    function isPageOpen(url) {
        return window.location.href.indexOf(url) >= 0;
    }

    function getThreadUser() {
        if (isPageOpen(PARTIAL_TWEET_URLS.TWEET_PAGE)) {
            // 'https://twitter.com/jdoe/status/1234567890'
            // ['https:', '', 'twitter.com', 'usernickname', 'status', '1234567890']
            const currentLocation = window.location.href;
            const currentReplyUserNickname = currentLocation.split('/')[3]
            // get all usernames in the thread
            const userNameNodes = document.querySelectorAll(TWITTER_SELECTOR.TEST_ID_USER_NAME)

            for (let i = 0; i < userNameNodes.length; i++) {
                // 'John Doe\n@jdoe\n\n7h' -> ['John Doe', '@jdoe', '7h']
                const userNameInfoSplit = userNameNodes[i].innerText.split('\n')
                if (userNameInfoSplit[1].replace('@', '') === currentReplyUserNickname) {
                    // string name, string nickname
                    return userNameInfoSplit[0]
                }
            }
        }
    }

    function pasteNameFullButton() {
        const tweetTextarea = document.querySelector(TWITTER_SELECTOR.TEST_ID_TWEET_TEXTAREA);
        pasteName(`${getFirstName()}`, tweetTextarea);
    }

    function pasteNameShortButton() {
        const dmTextInput = document.querySelector(TWITTER_SELECTOR.TEST_ID_DM_COMPOSER_TEXT_INPUT);
        pasteName(`${getFirstName()}`, dmTextInput);
    }

    function pasteName(name, destination) {
        if (name && destination) {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData("text/plain", name);
            if (destination) {
                destination.dispatchEvent(
                    new ClipboardEvent("paste", {
                        dataType: "text/plain",
                        data: name,
                        bubbles: true,
                        clipboardData: dataTransfer,
                        cancelable: true,
                    })
                );
            }
        }
    }

    function createFullPasteNameButton(buttonId) {
        const pasteNameButton = document.createElement("button");
        pasteNameButton.innerText = `Paste Name (${truncateName(getFirstName())})`;
        pasteNameButton.classList.add(GROWTH_X_PASTE_NAME_BUTTON_CLASS.FULL);
        pasteNameButton.setAttribute("id", buttonId);
        pasteNameButton.addEventListener("click", pasteNameFullButton);
        return pasteNameButton;
    }

    function createShortPasteNameButton() {
        const pasteNameButton = document.createElement("img");
        pasteNameButton.src = chrome.runtime.getURL('./img/nameInserter_logo_square_128x128_padding.png');
        pasteNameButton.classList.add(GROWTH_X_PASTE_NAME_BUTTON_CLASS.SHORT);
        pasteNameButton.setAttribute("id", GROWTH_X_PASTE_NAME_BUTTON_ID.SHORT);
        pasteNameButton.addEventListener("click", pasteNameShortButton);
        return pasteNameButton;
    }

    function insertPasteNameButton(tweetButtonTestId, buttonCreateFunction, buttonId) {
        const pasteNameButton = buttonCreateFunction(buttonId);
        const tweetButton = document.querySelector(tweetButtonTestId); // for modal
        tweetButton.parentNode.insertBefore(pasteNameButton, tweetButton);
    }

    function insertPasteNameButtonToModalInitialOpened() {
        if (isPageOpen(PARTIAL_TWEET_URLS.OPEN_MODAL)) {
            let attemptCount = 0;
            const intervalID = setInterval(() => {
                const modal = document.querySelector(TWITTER_SELECTOR.ARIA_MODAL);
                const replyUserName = modal?.querySelector(TWITTER_SELECTOR.TEST_ID_USER_NAME);
                if (replyUserName && attemptCount < MAX_INTERVAL_ATTEMPT && !document.getElementById(GROWTH_X_PASTE_NAME_BUTTON_ID.FULL_MODAL)) {
                    currentUserName = replyUserName.innerText.split('\n')[0];
                    clearInterval(intervalID)
                    insertPasteNameButton(TWEET_REPLY_BUTTON_TEST_ID.TWEET_BUTTON, createFullPasteNameButton, GROWTH_X_PASTE_NAME_BUTTON_ID.FULL_MODAL);
                } else if (attemptCount >= MAX_INTERVAL_ATTEMPT) {
                    clearInterval(intervalID)
                }
                attemptCount++
            }, INTERVAL_TIME)
        }
    }

    function observerUrlChange() {
        let previousUrl = window.location.href;
        const observer = new MutationObserver(function () {
            const currentLocation = window.location.href;
            if (previousUrl !== currentLocation && isPageOpen(PARTIAL_TWEET_URLS.OPEN_MODAL)) {
                insertPasteNameButtonToModalInitialOpened();
            } else if (previousUrl !== currentLocation && isPageOpen(PARTIAL_TWEET_URLS.MESSAGES) && !document.getElementById(GROWTH_X_PASTE_NAME_BUTTON_ID.SHORT)) {
                insertPasteNameButtonToDM();
            }
            previousUrl = window.location.href;
        });
        // start listening to changes
        observer.observe(document, OBSERVE_CONFIG);
    }

    const tweetFocusObserver = new MutationObserver(mutationRecords => {
        for (const mutation of mutationRecords) {
            const url = window.location.href;
            // Check if the TWEET_URLS contains "status".
            const status = url.indexOf(PARTIAL_TWEET_URLS.TWEET_PAGE);
            if (mutation.type === "childList" && status > -1) {
                const toolBar = mutation.target.querySelector(TWITTER_SELECTOR.TEST_ID_TOOLBAR)
                if(toolBar && !document.getElementById(GROWTH_X_PASTE_NAME_BUTTON_ID.FULL_TWEET)) {
                    currentUserName = getThreadUser();
                    insertPasteNameButton(TWEET_REPLY_BUTTON_TEST_ID.INLINE_TWEET_BUTTON, createFullPasteNameButton, GROWTH_X_PASTE_NAME_BUTTON_ID.FULL_TWEET);
                    return
                }
            }
        }
    });

    function insertPasteNameButtonToDM() {
        const currentLocation = window.location.href;
        const currentLocationSplit = currentLocation.split('/');
        const isMessages = currentLocationSplit[3] === PARTIAL_TWEET_URLS.MESSAGES;
        // check for https://twitter.com/messages screen
        if (currentLocationSplit.length <= 4) {
            return
        }
        // DM has path like 'messages/1234567890-1234567890'
        const isMessagesDM = currentLocationSplit[4].split('-').length === 2;

        if (isMessages && isMessagesDM) {
            let attemptCount = 0;
            const intervalID = setInterval(() => {
                const dmContainer = document.querySelector(TWITTER_SELECTOR.TEST_ID_DM_SCROLLER_CONTAINER)

                // UserAvatar-Container-unknown is used on the left side of the DM to select the user for DM,
                // that's why here is used from dmContainer
                // this selector is used to get the username if this the beginning of the DM
                const dmAvatar = dmContainer?.querySelector(TWITTER_SELECTOR.TEST_ID_USER_AVATAR_CONTAINER_UNKNOWN);
                // this selector is used to get the username if this is not the beginning of the DM
                const detailHeader = document.getElementById(TWITTER_SELECTOR.ID_DETAIL_HEADER)
                attemptCount++
                if ((dmContainer && (dmAvatar || detailHeader) && attemptCount < MAX_INTERVAL_ATTEMPT)) {
                    const dmName = dmAvatar?.nextSibling.innerText
                    currentUserName = dmName?.split('@')[0] || detailHeader.innerText;
                    insertPasteNameButton(TWEET_REPLY_BUTTON_TEST_ID.DM_SEND_BUTTON, createShortPasteNameButton);
                    clearInterval(intervalID)
                } else if (attemptCount >= MAX_INTERVAL_ATTEMPT) {
                    clearInterval(intervalID)
                }
            }, INTERVAL_TIME)
        }
    }

    function init() {
        insertPasteNameButtonToModalInitialOpened();
        observerUrlChange();
        insertPasteNameButtonToDM();
        tweetFocusObserver.observe(document, OBSERVE_CONFIG);
    }

    init();

})()
