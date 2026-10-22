chrome.runtime.onInstalled.addListener(async () => {
  const store = await chrome.storage.local.get('rqf_settings');
  if (!store.rqf_settings) {
    await chrome.storage.local.set({
      rqf_settings: { mapping_memory: true, llm_fallback: true }
    });
  }
});
