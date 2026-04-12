/**
 * Environment configuration.
 * All environment-specific values are centralized here.
 * Components must never read import.meta.env directly.
 */

export interface AppConfig {
  /** Base URL of the Orthanc REST API */
  orthancUrl: string;
  /** Base URL of the DICOMweb endpoint */
  dicomWebUrl: string;
  /** Whether authentication is enabled */
  authEnabled: boolean;
  /** Application mode */
  mode: 'demo' | 'production';
}

function resolveConfig(): AppConfig {
  const orthancUrl = import.meta.env.VITE_ORTHANC_URL as string | undefined;
  const dicomWebUrl = import.meta.env.VITE_DICOM_WEB_URL as string | undefined;
  const authEnabled = import.meta.env.VITE_AUTH_ENABLED as string | undefined;

  const isDemo = !orthancUrl;

  return {
    orthancUrl: orthancUrl || '/orthanc',
    dicomWebUrl: dicomWebUrl || '/dicom-web',
    authEnabled: authEnabled === 'true',
    mode: isDemo ? 'demo' : 'production',
  };
}

/** Singleton application config — resolved once at startup */
export const appConfig: Readonly<AppConfig> = Object.freeze(resolveConfig());
