class ChatPage {
  /**
   * Inject state into application's localStorage to bypass setup/login screen
   * and set up active server and channel connecting to local IRC server.
   * 
   * @param {Object} browserInstance - The WebdriverIO browser instance (alice or bob)
   * @param {Object} config - Configuration parameters for the user
   * @param {string} config.nick - Nickname for the instance (e.g. "Alice" or "Bob")
   * @param {string} [config.channelName="#general"] - Channel name to join
   * @param {number} [config.port=16667] - Custom unusual IRC port
   */
  async injectState(browserInstance, { nick, channelName = "#general", port = 16667 }) {
    // WebKitGTK blocks localStorage injection from WDIO (The operation is insecure),
    // so we automate the actual login form instead.

    const nameInput = await browserInstance.$('input[name="name"]');
    await nameInput.waitForExist({ timeout: 25000 });

    // Fill and submit initial server connection form directly via DOM
    await browserInstance.execute((nickVal, portVal) => {
        const setReactValue = (selector, value) => {
            const el = document.querySelector(selector);
            if (!el) return;
            const lastValue = el.value;
            el.value = value;
            const tracker = el._valueTracker;
            if (tracker) tracker.setValue(lastValue);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };

        setReactValue('input[name="name"]', 'E2E Server');
        setReactValue('input[name="host"]', '127.0.0.1');
        setReactValue('input[name="port"]', portVal);
        setReactValue('input[name="nickname"]', nickVal);

        const form = document.querySelector('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }, nick, port.toString());

    await browserInstance.pause(500);

    // If channel is not yet joined, open join channel modal & submit channelName
    await browserInstance.execute((chanVal) => {
        const setReactValue = (selector, value) => {
            const el = document.querySelector(selector);
            if (!el) return;
            const lastValue = el.value;
            el.value = value;
            const tracker = el._valueTracker;
            if (tracker) tracker.setValue(lastValue);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const textarea = document.querySelector('textarea');
        if (!textarea) {
            const buttons = Array.from(document.querySelectorAll('button'));
            const joinBtn = buttons.find(b => b.textContent.includes('Join') || b.textContent.includes('channel'));
            if (joinBtn) joinBtn.click();
        }
    }, channelName);

    await browserInstance.pause(500);

    await browserInstance.execute((chanVal) => {
        const setReactValue = (selector, value) => {
            const el = document.querySelector(selector);
            if (!el) return;
            const lastValue = el.value;
            el.value = value;
            const tracker = el._valueTracker;
            if (tracker) tracker.setValue(lastValue);
            el.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const channelInput = document.querySelector('input[name="name"]');
        if (channelInput) {
            setReactValue('input[name="name"]', chanVal);
            const form = channelInput.closest('form');
            if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
    }, channelName);

    // Wait for the chat textarea to become available, indicating successful login & navigation
    let textarea;
    try {
      textarea = await browserInstance.$('textarea');
      await textarea.waitForExist({ timeout: 15000 });
      // Wait until the IRC connection is established and the textarea becomes enabled
      await textarea.waitUntil(async function () {
          return (await this.getAttribute('disabled')) === null;
      }, {
          timeout: 15000,
          timeoutMsg: 'Expected textarea to become enabled (IRC connection successful) after 15s'
      });
    } catch (err) {
      const source = await browserInstance.getPageSource();
      console.error(`\n\n\n[DEBUG] FINAL DOM:\n${source}\n\n\n`);
      throw err;
    }
  }

  /**
   * Get chat input textarea element
   * @param {Object} browserInstance
   */
  async getChatInput(browserInstance) {
    const input = await browserInstance.$('textarea');
    await input.waitForExist({ timeout: 15000 });
    return input;
  }

  /**
   * Type message into chat input and submit via Enter
   * @param {Object} browserInstance
   * @param {string} text
   */
  async sendMessage(browserInstance, text) {
    const input = await this.getChatInput(browserInstance);
    await input.waitForEnabled({ timeout: 15000 });
    // 9. Verify we can type in the chat
    await browserInstance.execute((msg) => {
      const ta = document.querySelector('textarea');
      if (ta) {
          const lastValue = ta.value;
          ta.value = msg;
          const tracker = ta._valueTracker;
          if (tracker) tracker.setValue(lastValue);
          ta.dispatchEvent(new Event('input', { bubbles: true }));

          const form = ta.closest('form');
          if (form) {
             form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
      }
    }, text);
  }

  /**
   * Wait explicitly for a specific message text to appear in DOM tree
   * @param {Object} browserInstance
   * @param {string} messageText
   * @param {number} [timeout=15000]
   */
  async waitForMessage(browserInstance, messageText, timeout = 15000) {
    const selector = `//*[contains(text(), '${messageText}')]`;
    const messageElement = await browserInstance.$(selector);
    await messageElement.waitForExist({ timeout });
    return messageElement;
  }

  /**
   * Retrieve array of message text strings currently rendered on the screen
   * @param {Object} browserInstance
   * @returns {Promise<string[]>}
   */
  async getMessages(browserInstance) {
    const elements = await browserInstance.$$('.text-sm');
    const texts = [];
    for (const el of elements) {
      const txt = await el.getText();
      if (txt.trim()) {
        texts.push(txt.trim());
      }
    }
    return texts;
  }

  /**
   * Close the MOTD modal if it is currently open on the screen
   * @param {Object} browserInstance
   */
  async closeMotdModal(browserInstance) {
    await browserInstance.execute(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const closeBtn = buttons.find(b => b.textContent.trim() === 'Close');
      if (closeBtn) {
        closeBtn.click();
      }
    });
    await browserInstance.pause(500);
  }
}

export default new ChatPage();
