// Emulador de Meta Quest 3 en el navegador del PC (solo con ?emu en la URL).
// Simula visor, controles, passthrough, planos y malla de una habitación, para probar sin ponerse el Quest.
// API de iwer 2.8: installSEM(constructor) e installDevUI(constructor).
export async function maybeInstallEmulator() {
  const params = new URLSearchParams(location.search);
  if (!params.has('emu')) return null;
  const [{ XRDevice, metaQuest3 }, { DevUI }, { SyntheticEnvironmentModule }] = await Promise.all([
    import('iwer'), import('@iwer/devui'), import('@iwer/sem'),
  ]);
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true }); // Chrome ya trae WebXR nativo: lo reemplazamos por el emulado
  device.installSEM(SyntheticEnvironmentModule);
  device.installDevUI(DevUI);
  try {
    await device.sem.loadDefaultEnvironment(params.get('room') || 'sunlit_living_room');
  } catch (e) {
    console.warn('No se pudo cargar la habitación sintética:', e);
  }
  return device;
}
