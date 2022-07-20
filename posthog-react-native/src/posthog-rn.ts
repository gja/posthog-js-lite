import { AppState, Dimensions } from 'react-native'
import * as ExpoApplication from 'expo-application'
import * as ExpoDevice from 'expo-device'

import {
  PostHogCore,
  PosthogCoreOptions,
  PostHogFetchOptions,
  PostHogFetchResponse,
  PostHogPersistedProperty,
} from '../../posthog-core/src'
import { getLegacyValues } from './legacy'
import { SemiAsyncStorage, preloadSemiAsyncStorage } from './storage'
import { OptionalExpoLocalization } from './optional-imports'
import { version } from '../package.json'

export interface PostHogOptions extends PosthogCoreOptions {}

const STORAGE_PREFIX = '@posthog:'

export class PostHog extends PostHogCore {
  constructor(apiKey: string, options?: PostHogOptions) {
    super(apiKey, options)

    AppState.addEventListener('change', (state) => {
      this.flush()
    })

    // Ensure the async storage has been preloaded (this call is cached)
    preloadSemiAsyncStorage()

    // It is possible that the old library was used so we try to get the legacy distinctID
    preloadSemiAsyncStorage().then(() => {
      const key = `${STORAGE_PREFIX}${PostHogPersistedProperty.DistinctId}`
      if (!SemiAsyncStorage.getItem(key)) {
        getLegacyValues().then((legacyValues) => {
          if (legacyValues?.distinctId) {
            SemiAsyncStorage.setItem(key, legacyValues.distinctId)
          }
        })
      }
    })
  }

  getPersistedProperty<T>(key: PostHogPersistedProperty): T | undefined {
    return SemiAsyncStorage.getItem(`${STORAGE_PREFIX}${key}`) || undefined
  }
  setPersistedProperty<T>(key: PostHogPersistedProperty, value: T | null): void {
    return value !== null
      ? SemiAsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, value)
      : SemiAsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`)
  }

  fetch(url: string, options: PostHogFetchOptions): Promise<PostHogFetchResponse> {
    return fetch(url, options)
  }

  getLibraryId(): string {
    return 'posthog-react-native'
  }
  getLibraryVersion(): string {
    return version
  }
  getCustomUserAgent(): void {
    // TODO
    return
  }

  getCommonEventProperties(): any {
    return {
      ...super.getCommonEventProperties(),
      $app_build: '1',
      $app_name: ExpoApplication?.applicationName,
      $app_namespace: ExpoApplication?.applicationId,
      $app_version: ExpoApplication?.nativeApplicationVersion,
      // "$device_id": "F31C35E8-5B28-4626-8AFC-213D1C655FF9",
      $device_manufacturer: ExpoDevice?.manufacturer,
      //     "$device_model": "x86_64",
      $device_name: ExpoDevice?.modelName,
      // "$device_type": "ios",
      $locale: OptionalExpoLocalization?.locale,
      //     "$network_cellular": false,
      //     "$network_wifi": true,
      $os_name: ExpoDevice?.osName,
      $os_version: ExpoDevice?.osVersion,
      $screen_height: Dimensions.get('screen').height,
      $screen_width: Dimensions.get('screen').width,
      $timezone: OptionalExpoLocalization?.timezone,
    }
  }

  // Custom methods
  screen(name: string, properties?: any) {
    this.capture('$screen', {
      ...properties,
      $screen_name: name,
    })
  }
}
