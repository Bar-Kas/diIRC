import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { expect } from 'chai';
import chatPage from '../pageobjects/chat.page.js';

const require = createRequire(import.meta.url);

describe('Luna IRC Multi-Instance Messaging E2E Test', () => {
  const takeStageScreenshots = async (stageName) => {
    const modernScreenshotCode = fs.readFileSync(require.resolve('modern-screenshot/dist/index.js'), 'utf8');

    for (const [name, instance] of Object.entries({ alice: browser.alice, bob: browser.bob })) {
      try {
        const base64png = await instance.executeAsync((code, done) => {
          const script = document.createElement('script');
          script.textContent = code;
          document.head.appendChild(script);
          
          setTimeout(() => {
            if (window.modernScreenshot) {
              window.modernScreenshot.domToPng(document.body, { backgroundColor: '#1e1f22' }).then(dataUrl => {
                done(dataUrl);
              }).catch(err => done('ERROR: ' + err.toString()));
            } else {
              done('ERROR: modernScreenshot not loaded');
            }
          }, 300);
        }, modernScreenshotCode);

        if (base64png && base64png.startsWith('data:image/png;base64,')) {
          const buffer = Buffer.from(base64png.split(',')[1], 'base64');
          const dest = path.resolve(`./test/reports/screenshots/${name}-${stageName}.png`);
          fs.writeFileSync(dest, buffer);
          console.log(`[Screenshot] Successfully captured ${name}-${stageName} to ${dest}`);
        } else {
          console.error(`[Screenshot Error for ${name}-${stageName}]:`, base64png);
        }
      } catch (err) {
        console.error(`[Screenshot Exception for ${name}-${stageName}]:`, err);
      }
    }
  };

  it('should allow Alice to send a message and Bob to receive it', async function () {
    this.timeout(180000);
    const channelName = '#general';
    const messageContent = 'Hello z testów E2E!';

    // a & b) Inject initial state into Alice and Bob instances (triggers IRC login & MOTD popup)
    await chatPage.injectState(browser.alice, {
      nick: 'Alice',
      channelName: channelName
    });

    await chatPage.injectState(browser.bob, {
      nick: 'Bob',
      channelName: channelName
    });

    // STAGE 1: Capture MOTD Modal Screenshot
    await takeStageScreenshots('stage1-motd');

    // Dismiss MOTD Modal on both instances
    await chatPage.closeMotdModal(browser.alice);
    await chatPage.closeMotdModal(browser.bob);

    // c) Alice sends message "Hello z testów E2E!"
    await chatPage.sendMessage(browser.alice, messageContent);

    // d) Bob waits explicitly for the message to appear in his DOM tree
    const receivedMessageElement = await chatPage.waitForMessage(
      browser.bob,
      messageContent,
      15000
    );

    const isDisplayed = await receivedMessageElement.isDisplayed();
    expect(isDisplayed).to.be.true;

    // STAGE 2: Capture Chat View Screenshot after modal close and message receipt
    await takeStageScreenshots('stage2-chat');
  });
});
