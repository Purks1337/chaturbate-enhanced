// Constants
const SCRIPT_PREFIX = "[ChaturbateEnhanced]: ";
const SOURCE_LANG = 'en';
const TARGET_LANG = 'ru';
const TRANSLATION_PREFIX_TEXT = '';
const SCAN_INTERVAL = 2000;
const CLICK_DELAY = 750;
const RUSSIAN_REGEX = /[а-яА-ЯЁё]/;
const STATBATE_BASE_URL = 'https://plus.statbate.com/member/statbate/';

// Feature states
let features = {
    enabled: true,
    translation: true,
    blocker: true,
    statbate: true,
    tipInfo: true
};

// Initialize features from storage
chrome.storage.sync.get({
    extensionEnabled: true,
    translationEnabled: true,
    blockerEnabled: true,
    statbateEnabled: true,
    tipInfoEnabled: true
}, function(items) {
    features.enabled = items.extensionEnabled;
    features.translation = items.translationEnabled;
    features.blocker = items.blockerEnabled;
    features.statbate = items.statbateEnabled;
    features.tipInfo = items.tipInfoEnabled;
    initializeFeatures();
});

// Listen for toggle messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    switch(request.action) {
        case 'toggleExtension':
            features.enabled = request.enabled;
            if (features.enabled) {
                initializeFeatures();
            } else {
                // Скрыть все эффекты расширения
                document.querySelectorAll('.translated-chat-message').forEach(el => el.remove());
                document.querySelectorAll('.disabled-send-button-clone-cb-1-5').forEach(el => el.style.display = 'none');
                document.querySelectorAll('[data-testid="statbate-link-userscript"]').forEach(el => el.style.display = 'none');
                document.querySelectorAll('#' + INFO_WRAPPER_ID).forEach(el => el.style.display = 'none');
            }
            break;
        case 'toggleTranslation':
            features.translation = request.enabled;
            break;
        case 'toggleBlocker':
            features.blocker = request.enabled;
            break;
        case 'toggleStatbate':
            features.statbate = request.enabled;
            document.querySelectorAll('[data-testid="statbate-link-userscript"]').forEach(el => {
                el.style.display = features.statbate ? '' : 'none';
            });
            document.querySelectorAll('#' + INFO_WRAPPER_ID).forEach(el => {
                el.style.display = features.statbate ? '' : 'none';
            });
            break;
        case 'toggleTipInfo':
            features.tipInfo = request.enabled;
            break;
    }
});

function initializeFeatures() {
    if (!features.enabled) return;
    if (features.translation) {
        initializeTranslation();
    }
    if (features.blocker) {
        initializeBlocker();
    }
    if (features.statbate) {
        initializeStatbate();
    }
    if (features.tipInfo) {
        initializeTipInfo();
    }
}

function initializeTranslation() {
    console.log(SCRIPT_PREFIX + "Translation feature initialized");
    setTimeout(scanAndProcessMessages, 500);
    setInterval(scanAndProcessMessages, SCAN_INTERVAL);
    document.body.addEventListener('click', () => {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanAndProcessMessages, CLICK_DELAY);
    }, true);
}

let scanTimeout = null;

function scanAndProcessMessages() {
    const messages = document.querySelectorAll('[data-testid="chat-message"]');
    messages.forEach(msg => {
        if (msg.offsetParent !== null && !msg.dataset.translationProcessed && !msg.dataset.isTranslationClone && !msg.dataset.translationInProgress) {
            processMessage(msg);
        }
    });
}

function processMessage(messageNode) {
    const messageIdForLog = messageNode.dataset.ts || (messageNode.textContent || "").slice(0, 20).trim().replace(/\s+/g, '_');

    if (messageNode.dataset.translationProcessed === 'true' ||
        messageNode.dataset.isTranslationClone === 'true' ||
        messageNode.dataset.translationInProgress === 'true') {
        return;
    }

    const usernameElement = messageNode.querySelector('[data-testid="chat-message-username"]');
    const dataNick = messageNode.getAttribute('data-nick');

    if (!usernameElement && !dataNick) {
        messageNode.dataset.translationProcessed = 'true';
        return;
    }

    console.log(SCRIPT_PREFIX + `processMessage starting for [${messageIdForLog}]`);
    messageNode.dataset.translationInProgress = 'true';

    const textElement = messageNode.querySelector('[data-testid="chat-message-text"]');

    if (!textElement) {
        console.log(SCRIPT_PREFIX + `No textElement for [${messageIdForLog}]. Marking processed.`);
        messageNode.dataset.translationProcessed = 'true';
        delete messageNode.dataset.translationInProgress;
        return;
    }

    const originalTextSpan = textElement.querySelector('span');
    const originalText = (originalTextSpan || textElement).textContent.trim();

    if (!originalText) {
        console.log(SCRIPT_PREFIX + `Empty originalText for [${messageIdForLog}]. Marking processed.`);
        messageNode.dataset.translationProcessed = 'true';
        delete messageNode.dataset.translationInProgress;
        return;
    }

    const clonedMessage = messageNode.cloneNode(true);
    delete clonedMessage.dataset.translationProcessed;
    delete clonedMessage.dataset.translationInProgress;
    clonedMessage.dataset.isTranslationClone = 'true';
    clonedMessage.classList.add('translated-chat-message');
    if (clonedMessage.hasAttribute('data-ts')) {
        clonedMessage.removeAttribute('data-ts');
    }

    let clonedActualTextNode = clonedMessage.querySelector('[data-testid="chat-message-text"] span') || clonedMessage.querySelector('[data-testid="chat-message-text"]');

    if (clonedActualTextNode) {
        clonedActualTextNode.textContent = `${TRANSLATION_PREFIX_TEXT}Перевод...`;
    } else {
        console.warn(SCRIPT_PREFIX + `Could not find text node in cloned message for [${messageIdForLog}]. Clone HTML:`, clonedMessage.innerHTML);
        delete messageNode.dataset.translationInProgress;
        return;
    }

    if (messageNode.parentNode) {
        messageNode.parentNode.insertBefore(clonedMessage, messageNode.nextSibling);
    } else {
        console.error(SCRIPT_PREFIX + `Original message [${messageIdForLog}] has no parentNode. Cannot insert clone.`, messageNode);
        delete messageNode.dataset.translationInProgress;
        return;
    }

    messageNode.dataset.translationProcessed = 'true';

    translateText(originalText, clonedMessage, (translatedText, targetNode) => {
        let textNodeToUpdate = targetNode.querySelector('[data-testid="chat-message-text"] span') || targetNode.querySelector('[data-testid="chat-message-text"]');

        if (textNodeToUpdate) {
            textNodeToUpdate.textContent = `${TRANSLATION_PREFIX_TEXT}${translatedText}`;
        } else {
            console.warn(SCRIPT_PREFIX + `Could not find text node to update in cloned message for [${messageIdForLog}]. Text: "${translatedText}", Clone HTML:`, targetNode.innerHTML);
        }
        delete messageNode.dataset.translationInProgress;
    });
}

function translateText(text, targetClonedNode, onComplete) {
    if (!text || text.trim() === "" || text.trim().toLowerCase() === "перевод...") {
        if (text.trim().toLowerCase() === "перевод...") {
            console.log(SCRIPT_PREFIX + `Skipping translation for placeholder "Перевод..."`);
        }
        onComplete(text, targetClonedNode);
        return;
    }

    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${SOURCE_LANG}|${TARGET_LANG}`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.responseData && data.responseData.translatedText) {
                let translated = data.responseData.translatedText.replace(/<[^>]*>/g, "");
                if (data.responseData.match > 0.5 || translated.toLowerCase() !== text.toLowerCase()) {
                    onComplete(translated, targetClonedNode);
                } else {
                    onComplete(`(перевод: ${translated})`, targetClonedNode);
                }
            } else {
                console.warn(SCRIPT_PREFIX + 'Translation API error or no translation in responseData.', data);
                onComplete(text, targetClonedNode);
            }
        })
        .catch(error => {
            console.error(SCRIPT_PREFIX + 'Translation request error:', error);
            onComplete(text, targetClonedNode);
        });
}

function initializeBlocker() {
    console.log(SCRIPT_PREFIX + "Russian text blocker initialized");
    attachListenersToElements(document);
    observeAndAttach();
}

const INPUT_SELECTOR = 'div[data-testid="chat-input"]';
const ORIGINAL_SEND_BUTTON_SELECTOR = 'button[data-testid="send-button"]';
const FORM_SELECTOR = '.chat-input-form';
const DISABLED_BUTTON_CLASS = 'disabled-send-button-clone-cb-1-5';

const disabledButtonsMap = new WeakMap();

function getOrCreateDisabledButton(originalButton) {
    if (disabledButtonsMap.has(originalButton)) {
        return disabledButtonsMap.get(originalButton);
    }
    const clone = originalButton.cloneNode(true);
    clone.classList.add(DISABLED_BUTTON_CLASS);
    clone.title = "Отправка на русском запрещена";
    clone.style.display = 'none';
    clone.removeAttribute('data-paction');
    clone.removeAttribute('data-pactionname');
    if (clone.type === 'submit') clone.type = 'button';

    clone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);

    originalButton.parentNode.insertBefore(clone, originalButton.nextSibling);
    disabledButtonsMap.set(originalButton, clone);
    return clone;
}

function updateButtonVisibility(inputField, originalSendButton, disabledButtonClone) {
    if (!inputField || !originalSendButton || !disabledButtonClone) return;
    const text = inputField.textContent || "";
    if (RUSSIAN_REGEX.test(text)) {
        originalSendButton.style.display = 'none';
        disabledButtonClone.style.display = '';
    } else {
        originalSendButton.style.display = '';
        disabledButtonClone.style.display = 'none';
    }
}

function handleInputChangeOrFocus(event) {
    const inputField = event.target;
    if (!inputField || !inputField.matches(INPUT_SELECTOR)) return;
    const inputDiv = inputField.closest('.inputDiv');
    if (!inputDiv) return;
    const originalSendButton = inputDiv.querySelector(ORIGINAL_SEND_BUTTON_SELECTOR);
    if (!originalSendButton) return;
    const disabledButtonClone = getOrCreateDisabledButton(originalSendButton);
    updateButtonVisibility(inputField, originalSendButton, disabledButtonClone);
}

function blockActionIfRussian(event, inputField) {
    if (!inputField) return false;
    const text = inputField.textContent || "";
    if (RUSSIAN_REGEX.test(text)) {
        console.log(SCRIPT_PREFIX + "Russian text detected. Blocking action for event:", event.type, event.target);
        event.preventDefault();
        event.stopImmediatePropagation();

        const inputDiv = inputField.closest('.inputDiv');
        if (inputDiv) {
            const originalSendButton = inputDiv.querySelector(ORIGINAL_SEND_BUTTON_SELECTOR);
            if (originalSendButton) {
                const disabledButton = disabledButtonsMap.get(originalSendButton);
                if (disabledButton) {
                    originalSendButton.style.display = 'none';
                    disabledButton.style.display = '';
                }
            }
        }
        return true;
    }
    return false;
}

function formSubmitHandler(event) {
    const form = event.target;
    const inputField = form.querySelector(INPUT_SELECTOR);
    blockActionIfRussian(event, inputField);
}

function sendButtonClickHandler(event) {
    const button = event.currentTarget;
    const form = button.closest(FORM_SELECTOR);
    const inputDiv = button.closest('.inputDiv');
    let inputField = null;

    if (form) inputField = form.querySelector(INPUT_SELECTOR);
    if (!inputField && inputDiv) inputField = inputDiv.querySelector(INPUT_SELECTOR);

    blockActionIfRussian(event, inputField);
}

function inputKeydownHandler(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        const inputField = event.target;
        blockActionIfRussian(event, inputField);
    }
}

function attachListenersToElements(elementScope = document) {
    elementScope.querySelectorAll(INPUT_SELECTOR).forEach(inputField => {
        if (!inputField.dataset.vrbListeners) {
            inputField.addEventListener('input', handleInputChangeOrFocus);
            inputField.addEventListener('focus', handleInputChangeOrFocus);
            inputField.addEventListener('keydown', inputKeydownHandler, true);
            inputField.dataset.vrbListeners = 'inputFocusKeydown';
            handleInputChangeOrFocus({ target: inputField });
        }
    });

    elementScope.querySelectorAll(ORIGINAL_SEND_BUTTON_SELECTOR).forEach(button => {
        if (!button.dataset.vrbListeners) {
            button.addEventListener('click', sendButtonClickHandler, true);
            button.dataset.vrbListeners = 'click';
            const inputDiv = button.closest('.inputDiv');
            if (inputDiv) {
                const inputField = inputDiv.querySelector(INPUT_SELECTOR);
                if (inputField) getOrCreateDisabledButton(button);
            }
        }
    });

    elementScope.querySelectorAll(FORM_SELECTOR).forEach(form => {
        if (!form.dataset.vrbListeners) {
            form.addEventListener('submit', formSubmitHandler, true);
            form.dataset.vrbListeners = 'submit';
        }
    });
}

function observeAndAttach() {
    attachListenersToElements(document);
    const observer = new MutationObserver((mutationsList) => {
        let newElementsFound = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches(INPUT_SELECTOR) || node.querySelector(INPUT_SELECTOR) ||
                            node.matches(ORIGINAL_SEND_BUTTON_SELECTOR) || node.querySelector(ORIGINAL_SEND_BUTTON_SELECTOR) ||
                            node.matches(FORM_SELECTOR) || node.querySelector(FORM_SELECTOR)) {
                            attachListenersToElements(node);
                            newElementsFound = true;
                        }
                    }
                });
            }
        }
        if (newElementsFound) {
            document.querySelectorAll(INPUT_SELECTOR + '[data-vrb-listeners*="inputFocusKeydown"]').forEach(inputField => {
                if (inputField.offsetParent !== null) handleInputChangeOrFocus({target: inputField});
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function initializeStatbate() {
    console.log(SCRIPT_PREFIX + "Statbate integration initialized");
    const observer = new MutationObserver(function(mutationsList) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        let menuNode = null;
                        if (node.id === 'user-context-menu' && node.dataset.testid === 'user-context-menu') {
                            menuNode = node;
                        } else if (typeof node.querySelector === 'function') {
                            menuNode = node.querySelector('#user-context-menu[data-testid="user-context-menu"]');
                        }

                        if (menuNode) {
                            if (document.body.contains(menuNode) && getComputedStyle(menuNode).visibility !== 'hidden') {
                                setTimeout(() => addStatbateButton(menuNode), 150);
                            }
                        }
                    }
                });
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

const STATBATE_BUTTON_ID_PREFIX = 'userscript-statbate-button-';

const statbateIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"/>
    </svg>
`;

function addStatbateButton(menuNode) {
    const usernameLink = menuNode.querySelector('.ucmHeader [data-testid="username"]');
    let username = 'unknown_user';

    if (usernameLink && usernameLink.textContent) {
        username = usernameLink.textContent.trim();
    } else {
        console.log(SCRIPT_PREFIX + 'Username not found in context menu header using [data-testid="username"].');
    }

    const uniqueStatbateButtonId = STATBATE_BUTTON_ID_PREFIX + username.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (menuNode.querySelector(`#${uniqueStatbateButtonId}`)) {
        return;
    }

    const sendPmButtons = menuNode.querySelectorAll('.ucmLinks [data-testid="send-pm"]');
    let originalPmButton = null;
    for (const btn of sendPmButtons) {
        const span = btn.querySelector('span');
        if (span && span.textContent && span.textContent.trim().toLowerCase() === 'send private message') {
            originalPmButton = btn;
            break;
        }
    }

    if (!originalPmButton) {
        console.log(SCRIPT_PREFIX + 'Original "Send private message" button not found in:', menuNode);
        return;
    }

    const statbateButton = originalPmButton.cloneNode(true);
    statbateButton.id = uniqueStatbateButtonId;
    statbateButton.dataset.testid = 'statbate-link-userscript';

    const spanInClonedButton = statbateButton.querySelector('span');
    if (spanInClonedButton) {
        spanInClonedButton.textContent = 'Statbate';
        spanInClonedButton.title = `View ${username} on Statbate Plus`;
    }

    const originalIconDiv = statbateButton.querySelector('.ucmSendPmIcon');
    if (originalIconDiv) {
        const newIconContainer = document.createElement('div');
        newIconContainer.style.display = "inline-flex";
        newIconContainer.style.alignItems = "center";
        newIconContainer.style.justifyContent = "center";
        newIconContainer.style.width = "18px";
        newIconContainer.style.height = "14px";
        newIconContainer.style.marginRight = "4px";
        newIconContainer.style.verticalAlign = "middle";
        newIconContainer.innerHTML = statbateIconSvg;
        originalIconDiv.replaceWith(newIconContainer);
    } else {
        const iconElement = document.createElement('div');
        iconElement.style.display = "inline-flex";
        iconElement.style.alignItems = "center";
        iconElement.style.justifyContent = "center";
        iconElement.style.width = "18px";
        iconElement.style.height = "14px";
        iconElement.style.marginRight = "4px";
        iconElement.style.verticalAlign = "middle";
        iconElement.innerHTML = statbateIconSvg;
        if (spanInClonedButton) {
            statbateButton.insertBefore(iconElement, spanInClonedButton);
        }
    }

    statbateButton.dataset.username = username;
    statbateButton.removeAttribute('onclick');
    statbateButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        const userOnClick = this.dataset.username;

        if (userOnClick && userOnClick !== 'unknown_user') {
            const statbateUrl = `${STATBATE_BASE_URL}${userOnClick}`;
            console.log(SCRIPT_PREFIX + `Opening Statbate Plus for user: ${userOnClick} at ${statbateUrl}`);
            window.open(statbateUrl, '_blank').focus();
        } else {
            alert('Statbate button clicked, but username could not be determined for the link.');
            console.log(SCRIPT_PREFIX + 'Statbate button clicked, but username is unknown.');
        }
    });

    if (originalPmButton.parentNode) {
        originalPmButton.parentNode.insertBefore(statbateButton, originalPmButton);
        console.log(SCRIPT_PREFIX + `Statbate button added for user: ${username}`);
    } else {
        console.error(SCRIPT_PREFIX + 'Parent node of original PM button not found. Cannot insert Statbate button.');
    }
}

function initializeTipInfo() {
    console.log(SCRIPT_PREFIX + "Tip info feature initialized");
    const observer = new MutationObserver(function(mutationsList, observerInstance) {
        for (const mutation of mutationsList) {
            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        let menuNode = null;
                        if (node.id === 'user-context-menu' && node.dataset.testid === 'user-context-menu') {
                            menuNode = node;
                        } else if (typeof node.querySelector === 'function') {
                            menuNode = node.querySelector('#user-context-menu[data-testid="user-context-menu"]');
                        }
                        if (menuNode && getComputedStyle(menuNode).visibility !== 'hidden') {
                            setTimeout(() => {
                                if (features.statbate) {
                                    createVisualInfoBlocks(menuNode);
                                } else {
                                    // Если statbate выключен, удаляем блок tip info если он есть
                                    const infoBlock = menuNode.querySelector('#' + INFO_WRAPPER_ID);
                                    if (infoBlock) infoBlock.remove();
                                }
                            }, 100);
                        }
                    }
                }
            }
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

const INFO_WRAPPER_ID = 'userscript-statbate-custom-tip-info';

function parseDateTime(dateTimeString) {
    if (!dateTimeString || dateTimeString === 'N/A' || typeof dateTimeString !== 'string') return { date: 'N/A', time: 'N/A' };
    try {
        const parts = dateTimeString.trim().split(' ');
        if (parts.length < 2) return { date: dateTimeString, time: 'N/A' };
        const datePart = parts[0];
        const timePart = parts[1];
        const dateParts = datePart.split('-');
        if (dateParts.length < 3) return { date: dateTimeString, time: 'N/A' };
        const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0].slice(-2)}`;
        const formattedTime = timePart.substring(0, 5);
        return { date: formattedDate, time: formattedTime };
    } catch (e) {
        console.error(SCRIPT_PREFIX + 'Error parsing date/time string:', dateTimeString, e);
        return { date: 'Parse Err', time: 'Parse Err' };
    }
}

function formatAmount(amount, currency = '$') {
    if (amount === null || typeof amount === 'undefined' || amount === '') return 'N/A';
    return `${currency}${Number(amount).toFixed(2)}`;
}

async function fetchAndDisplayTipInfo(menuNode, username) {
    if (!username || username === 'unknown_user') {
        console.warn('Tip Info: Username is unknown, cannot fetch data.');
        return;
    }
    const statbateUserPageUrl = `${STATBATE_BASE_URL}${username}`;
    const ftDateEl = menuNode.querySelector('[data-statbate-ft-date]');
    const ftTimeEl = menuNode.querySelector('[data-statbate-ft-time]');
    const ftAmountEl = menuNode.querySelector('[data-statbate-ft-amount]');
    const ltDateEl = menuNode.querySelector('[data-statbate-lt-date]');
    const ltTimeEl = menuNode.querySelector('[data-statbate-lt-time]');
    const ltAmountEl = menuNode.querySelector('[data-statbate-lt-amount]');
    const atTipsEl = menuNode.querySelector('[data-statbate-at-tips]');
    const atAmountEl = menuNode.querySelector('[data-statbate-at-amount]');
    const allDataElements = [ftDateEl, ftTimeEl, ftAmountEl, ltDateEl, ltTimeEl, ltAmountEl, atTipsEl, atAmountEl];
    allDataElements.forEach(el => { if (el) el.textContent = 'Loading...'; });
    console.log(`Tip Info: Fetching data for ${username} from ${statbateUserPageUrl}`);

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'fetchStatbateData',
                url: statbateUserPageUrl
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (!response.success) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });

        const parser = new DOMParser();
        const doc = parser.parseFromString(response.html, "text/html");
        const appDiv = doc.getElementById('app');

        if (!appDiv) {
            console.error('Tip Info: <div id="app"> not found in Statbate HTML.');
            allDataElements.forEach(el => { if (el) el.textContent = 'Struct Err 1'; });
            return;
        }

        const dataPageAttr = appDiv.dataset.page || appDiv.getAttribute('data-page');
        if (!dataPageAttr) {
            console.error('Tip Info: data-page attribute not found on <div id="app">.');
            allDataElements.forEach(el => { if (el) el.textContent = 'Struct Err 2'; });
            return;
        }

        const pageData = JSON.parse(dataPageAttr);
        console.log('Tip Info: Parsed pageData from data-page:', pageData);

        const tipStats = pageData.props?.data?.tipStats;

        if (!tipStats) {
            console.warn('Tip Info: tipStats object not found in pageData.props.data. User may have no tip data or structure changed.', pageData.props?.data);
            const tipStatsAlt = pageData.props?.tipStats;
            if (tipStatsAlt) {
                console.log('Tip Info: Found tipStats in pageData.props.tipStats');
            }

            allDataElements.forEach(el => { if (el) el.textContent = 'No Stats'; });
            if (pageData.props?.room?.name === username) {
                console.log('Tip Info: It seems this is the correct user page, but tipStats is missing. User might have no tip history.');
            }
            return;
        }

        console.log('Tip Info: Found tipStats:', tipStats);

        // First Tip
        if (tipStats.firstTipDate && tipStats.firstTipAmount !== undefined) {
            const ftDT = parseDateTime(tipStats.firstTipDate);
            ftDateEl.textContent = ftDT.date;
            ftTimeEl.textContent = ftDT.time;
            ftAmountEl.textContent = formatAmount(tipStats.firstTipAmount);
        } else {
            ftDateEl.textContent = 'N/A'; ftTimeEl.textContent = 'N/A'; ftAmountEl.textContent = 'N/A';
        }

        // Last Tip
        if (tipStats.lastTipDate && tipStats.lastTipAmount !== undefined) {
            const ltDT = parseDateTime(tipStats.lastTipDate);
            ltDateEl.textContent = ltDT.date;
            ltTimeEl.textContent = ltDT.time;
            ltAmountEl.textContent = formatAmount(tipStats.lastTipAmount);
        } else {
            ltDateEl.textContent = 'N/A'; ltTimeEl.textContent = 'N/A'; ltAmountEl.textContent = 'N/A';
        }

        // All Time
        if (tipStats.totalTipCount !== undefined && tipStats.totalTipSum !== undefined) {
            atTipsEl.textContent = String(tipStats.totalTipCount);
            atAmountEl.textContent = formatAmount(tipStats.totalTipSum);
        } else {
            atTipsEl.textContent = 'N/A'; atAmountEl.textContent = 'N/A';
        }

        console.log('Tip Info: Data extracted and displayed.');

    } catch (error) {
        console.error('Tip Info: Error fetching or processing Statbate data:', error);
        allDataElements.forEach(el => { if (el) el.textContent = 'Error'; });
    }
}

function createVisualInfoBlocks(menuNode) {
    if (!features.statbate) {
        // Если statbate выключен, не показываем блок
        const infoBlock = menuNode.querySelector('#' + INFO_WRAPPER_ID);
        if (infoBlock) infoBlock.remove();
        return;
    }
    if (menuNode.querySelector(`#${INFO_WRAPPER_ID}`)) {
        return;
    }

    const ucmLinks = menuNode.querySelector('.ucmLinks');
    if (!ucmLinks) {
        console.warn(SCRIPT_PREFIX + '.ucmLinks element not found in menu.');
        return;
    }

    const computedStyle = window.getComputedStyle(ucmLinks);
    const borderColor = computedStyle.borderTopColor || '#e0e0e0';

    const infoWrapper = document.createElement('div');
    infoWrapper.id = INFO_WRAPPER_ID;

    const firstLastTipRow = document.createElement('div');
    firstLastTipRow.className = 'ucmUserLabel';
    firstLastTipRow.style.padding = '9px 10px';
    firstLastTipRow.style.borderTop = `1px solid ${borderColor}`;
    firstLastTipRow.style.display = 'flex';
    firstLastTipRow.style.justifyContent = 'space-between';

    const firstTipBlock = document.createElement('div');
    firstTipBlock.style.flexBasis = '48%';
    firstTipBlock.innerHTML = `
        <div style="font-weight: bold; height: 12px; margin-bottom: 4px;">First tip</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px;" data-statbate-ft-date>N/A</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px;" data-statbate-ft-time>N/A</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px; font-weight: bold;" data-statbate-ft-amount>N/A</div>
    `;

    const lastTipBlock = document.createElement('div');
    lastTipBlock.style.flexBasis = '48%';
    lastTipBlock.innerHTML = `
        <div style="font-weight: bold; height: 12px; margin-bottom: 4px;">Last tip</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px;" data-statbate-lt-date>N/A</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px;" data-statbate-lt-time>N/A</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px; font-weight: bold;" data-statbate-lt-amount>N/A</div>
    `;

    firstLastTipRow.appendChild(firstTipBlock);
    firstLastTipRow.appendChild(lastTipBlock);
    infoWrapper.appendChild(firstLastTipRow);

    const allTimeBlock = document.createElement('div');
    allTimeBlock.className = 'ucmUserLabel';
    allTimeBlock.style.padding = '9px 10px';
    allTimeBlock.style.borderTop = `1px solid ${borderColor}`;
    allTimeBlock.innerHTML = `
        <div style="font-weight: bold; height: 12px; margin-bottom: 10px;">All time</div>
        <div class="ucmSublabel" style="font-size: 10px; margin-top: 4px; display: flex; justify-content: space-between;">
            <span>Total Tips:</span>
            <span data-statbate-at-tips>N/A</span>
        </div>
        <div class="ucmSublabel" style="font-size: 10px; display: flex; justify-content: space-between;">
            <span>Total Amount:</span>
            <span data-statbate-at-amount>N/A</span>
        </div>
    `;

    infoWrapper.appendChild(allTimeBlock);
    ucmLinks.parentNode.insertBefore(infoWrapper, ucmLinks);

    const usernameLink = menuNode.querySelector('.ucmHeader [data-testid="username"]');
    let username = 'unknown_user';
    if (usernameLink && usernameLink.textContent) {
        username = usernameLink.textContent.trim();
    } else {
        console.log(SCRIPT_PREFIX + 'Username not found in context menu header for API call.');
    }

    fetchAndDisplayTipInfo(menuNode, username);
}

// Feature initialization functions will be added in the next parts 