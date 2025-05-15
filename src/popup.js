document.addEventListener('DOMContentLoaded', function() {
    const blockerToggle = document.getElementById('blockerToggle');
    const translationToggle = document.getElementById('translationToggle');
    const statbateToggle = document.getElementById('statbateToggle');
    const tipInfoToggle = document.getElementById('tipInfoToggle');
    const powerBtn = document.getElementById('powerBtn');
    const statusValue = document.getElementById('statusValue');
    const updateBtn = document.getElementById('updateBtn');

    // Check for updates
    chrome.storage.local.get(['updateAvailable', 'updateUrl'], function(result) {
        if (result.updateAvailable) {
            updateBtn.style.color = '#FF0000';
            updateBtn.title = 'Доступно обновление!';
        }
    });

    // Update button click handler
    if (updateBtn) {
        updateBtn.addEventListener('click', function() {
            chrome.storage.local.get(['updateUrl'], function(result) {
                if (result.updateUrl) {
                    window.open(result.updateUrl, '_blank');
                } else {
                    window.open('https://github.com/Purks1337/chaturbate-enhanced/releases', '_blank');
                }
            });
        });
    }

    // Функция для обновления UI статуса
    function updateStatusUI(enabled) {
        if (statusValue) {
            statusValue.textContent = enabled ? 'Включено' : 'Выключено';
            statusValue.classList.toggle('enabled', enabled);
            statusValue.classList.toggle('disabled', !enabled);
        }
        // Отключаем/включаем все переключатели
        [blockerToggle, translationToggle, statbateToggle, tipInfoToggle].forEach(function(toggle) {
            if (toggle) toggle.disabled = !enabled;
        });
    }

    // Загрузка состояния
    chrome.storage.sync.get({
        extensionEnabled: true,
        translationEnabled: true,
        blockerEnabled: true,
        statbateEnabled: true,
        tipInfoEnabled: true
    }, function(items) {
        updateStatusUI(items.extensionEnabled);
        if (blockerToggle) blockerToggle.checked = items.blockerEnabled;
        if (translationToggle) translationToggle.checked = items.translationEnabled;
        if (statbateToggle) statbateToggle.checked = items.statbateEnabled;
        if (tipInfoToggle) tipInfoToggle.checked = items.tipInfoEnabled;
    });

    // Обработка клика по powerBtn
    if (powerBtn) {
        powerBtn.addEventListener('click', function() {
            chrome.storage.sync.get({ extensionEnabled: true }, function(items) {
                const newEnabled = !items.extensionEnabled;
                chrome.storage.sync.set({ extensionEnabled: newEnabled }, function() {
                    updateStatusUI(newEnabled);
                    // Сообщаем контент-скрипту о смене статуса
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleExtension', enabled: newEnabled });
                    });
                });
            });
        });
    }

    // Обработчики переключателей
    if (blockerToggle) {
        blockerToggle.addEventListener('change', function() {
            chrome.storage.sync.set({ blockerEnabled: blockerToggle.checked });
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleBlocker', enabled: blockerToggle.checked });
            });
        });
    }

    if (translationToggle) {
        translationToggle.addEventListener('change', function() {
            chrome.storage.sync.set({ translationEnabled: translationToggle.checked });
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleTranslation', enabled: translationToggle.checked });
            });
        });
    }

    if (statbateToggle) {
        statbateToggle.addEventListener('change', function() {
            chrome.storage.sync.set({ statbateEnabled: statbateToggle.checked });
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleStatbate', enabled: statbateToggle.checked });
            });
        });
    }

    if (tipInfoToggle) {
        tipInfoToggle.addEventListener('change', function() {
            chrome.storage.sync.set({ tipInfoEnabled: tipInfoToggle.checked });
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleTipInfo', enabled: tipInfoToggle.checked });
            });
        });
    }
}); 