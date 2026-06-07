declare module "obsbot-sdk" {
  export type Preset = { id: number; pitch: number; pan: number; zoom: number }
  export type GimbalStatus = { roll: number; pitch: number; pan: number }
  export type TinyStatus = {
    gimbal: GimbalStatus
    zoom: number
    zoom_ratio: number
    ai_target: number
    ai_mode: number
    ai_sub_mode: number
    hdr: number
    face_ae: number
    dev_status: number
    vertical_mode: number
    face_auto_focus: number
    auto_focus: number
    led_brightness_level: number
    gestture_target: boolean
    gestture_zoom: boolean
    gestture_dynamic_zoom: boolean
    gestture_mirror: boolean
  }
  export type Capabilities = {
    zoom: { min: number; max: number; default: number; step: number }
    brightness: { min: number; max: number; default: number; step: number }
    contrast: { min: number; max: number; default: number; step: number }
    saturation: { min: number; max: number; default: number; step: number }
    sharpness: { min: number; max: number; default: number; step: number }
    hue: { min: number; max: number; default: number; step: number }
  }

  export type NativeDevice = {
    getGimbalPose?(): { roll: number; pitch: number; pan: number } | undefined
  }

  export class BaseDevice {
    _native: NativeDevice
    getSn(): string
    getName(): string
    getProductType(): number
    getProductTypeName(): string | undefined
    getUUID(): string
    getModelCode(): string
    getVideoDevPath(): string
    getAudioDevPath(): string
    gimbalReset(): boolean
    gimbalMove(pitch: number, pan: number): boolean
    setZoom(zoom: number): boolean
    getZoom(): number
    getZoomRange(): { min: number; max: number }
    setHDR(enable: boolean): boolean
    getCapabilities(): Capabilities | undefined
    getImageSetting(setting: string): number
    setImageSetting(setting: string, value: number): boolean
  }
  export class TinyDevice extends BaseDevice {
    getStatus(): TinyStatus | undefined
    getPresetList(): Preset[] | undefined
    goToPreset(id: number): boolean
    addPreset(id: number): boolean
    deletePreset(id: number): boolean
    setAiTrackingMode(mode: number): boolean
    setAiMode(mode: number, subMode?: number): boolean
    toggleGestureTarget(enable: boolean): boolean
    toggleGestureZoom(enable: boolean): boolean
  }
  export class MeetDevice extends BaseDevice {}

  export const osbotSdk: {
    init(debug?: boolean): number
    release(): void
    setDevChangedCallback(cb: (sn: string, attached: boolean) => void): void
    getDevList(): BaseDevice[]
    ObsbotProductType: Record<string, number>
    BaseDevice: typeof BaseDevice
    TinyDevice: typeof TinyDevice
    MeetDevice: typeof MeetDevice
    native: unknown
  }
}
