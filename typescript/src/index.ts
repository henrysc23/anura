const meta1 = document.createElement('meta');
meta1.httpEquiv = "Cross-Origin-Opener-Policy";
meta1.content = "same-origin";
document.head.appendChild(meta1);

const meta2 = document.createElement('meta');
meta2.httpEquiv = "Cross-Origin-Embedder-Policy";
meta2.content = "require-corp";
document.head.appendChild(meta2);


import "./styles.css"; // Rollup will process this

import {
  Measurement,
  faceAttributeValue,
  faceTrackerState,
  type ConstraintFeedback,
  type ConstraintStatus,
  type Drawables,
  type Results,
  type IsoDate,
  type MediaElementResizeEvent,
  type MeasurementOptions,
  type Settings,
  type FaceTrackerStateType,
  type Demographics,
  type ChunkSent
} from "@nuralogix.ai/anura-web-core-sdk";
import helpers, { type CameraStatusChanged, SelectedCameraChanged} from "@nuralogix.ai/anura-web-core-sdk/helpers";
import { VitalMask } from "@nuralogix.ai/anura-web-core-sdk/masks/vital";

const { CameraController } = helpers;
let trackerState: FaceTrackerStateType = faceTrackerState.ASSETS_NOT_DOWNLOADED;

const mediaElement = document.getElementById('measurement') as HTMLDivElement;
const cameraList = document.getElementById('camera-list') as HTMLSelectElement;
const toggleCameraButton = document.getElementById('toggle-camera') as HTMLButtonElement;
const toggleMeasurementButton = document.getElementById('toggle-measurement') as HTMLButtonElement;
if (mediaElement && mediaElement instanceof HTMLDivElement) {
    const settings: Settings = {
        mediaElement,
        assetFolder: 'https://unpkg.com/@nuralogix.ai/anura-web-core-sdk/lib/assets',
        apiUrl: 'api.deepaffex.ai',
        mirrorVideo: true,
        displayMediaStream: true,
        metrics: false,
        logger: {
            extractionLibWasm: false,
            mediaPipe: false,
            beforeRESTCall: false,
            afterRESTCall: false,
            sdk: false,
            extractionWorker: false,
            faceTrackerWorkers: false,
        }
    };
    const mask = new VitalMask();
    const measurement = await Measurement.init(settings);
    measurement.setSettings({
        logger: {
            webSocket: false,
        }
    });

    const demographics: Demographics = {
        age: 40,
        height: 180,
        weight: 60,
        sex: faceAttributeValue.SEX_ASSIGNED_MALE_AT_BIRTH,
        smoking: faceAttributeValue.SMOKER_FALSE,
        bloodPressureMedication: faceAttributeValue.BLOOD_PRESSURE_MEDICATION_FALSE,
        diabetes: faceAttributeValue.DIABETES_NONE,
        unit: 'Metric'
    };
    measurement.setDemographics(demographics);

    const camera = CameraController.init();
    let isCameraOpen = false;
    const onSelectedDeviceChanged = (e: SelectedCameraChanged) => {
        const { deviceId } = e.detail;
        console.log('Selected deviceId', deviceId);
    };

    const onCameraStatus = async (e: CameraStatusChanged) => {
      const { isOpen } = e.detail;
      if (isOpen) {
          const { capabilities } = e.detail;
          console.log({ capabilities });
      }
      isCameraOpen = isOpen;
      if (isCameraOpen && camera.cameraStream) {
          await measurement.setMediaStream(camera.cameraStream);
          const success = measurement.setObjectFit(mask.objectFit);
          if (success) measurement.loadMask(mask.getSvg());
      }
    }

    camera.addEventListener('selectedDeviceChanged', (onSelectedDeviceChanged as EventListener));
    camera.addEventListener('cameraStatus', (onCameraStatus as unknown as EventListener));

    const isPermissionGranted = await camera.requestPermission();
    if (isPermissionGranted && cameraList) {
        await camera.list();
        cameraList.innerHTML = ''; // Clears all options
        const list = camera.mediaDevices.map(mediaDevice => ({
            value: mediaDevice.device.deviceId, text: mediaDevice.device.label
        }));
        list.forEach(optionData => {
            const optionElement = document.createElement('option');
            optionElement.value = optionData.value;
            optionElement.textContent = optionData.text;
            cameraList.appendChild(optionElement);
        });
        cameraList.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLSelectElement;
            if (target && target.value) camera.setDeviceId(target.value);
        });
    }

    const disableButton = (id: string, disabled: boolean) => {
      const element = document.getElementById(id);
      if (element) {
          if (disabled) {
              element.setAttribute('disabled', 'true');
          } else {
              element.removeAttribute('disabled');
          }
      };
    }

    const toggleCamera = async () => {
        if (isCameraOpen) {
            camera.stop();
            disableButton('toggle-measurement', true);
            disableButton('toggle-camera', false);
            await measurement.stopTracking();
            mask.setMaskVisibility(false);
        } else {
            const success = await camera.start(1280, 720);
        }
    }

    if (toggleCameraButton) {
        toggleCameraButton.addEventListener('click', async () => {
            toggleCameraButton.textContent === 'Open'
            ? toggleCameraButton.textContent = 'Close'
            : toggleCameraButton.textContent = 'Open';
            await toggleCamera();
        });
    }

    if (toggleMeasurementButton) {
        toggleMeasurementButton.addEventListener('click', async () => {
            // You can optionally pass measurement options to the startMeasurement method
            // Both userProfileId and partnerId are optional
            // const measurementOptions: MeasurementOptions = {
            //   userProfileId: "userProfileId",
            //   partnerId: "partnerId",
            // };
            disableButton('toggle-measurement', true);
            await measurement.startMeasurement();
        });
    }

    measurement.on.bytesDownloaded = (bytes: number, url: string, done: boolean) => {
      // console.log("Bytes downloaded", bytes, url, done);
    };

    measurement.on.downloadError = (url: string, error: unknown) => {
        // console.log("Download error", url, error);
    };

    measurement.on.beforeRESTCall = (timestamp: IsoDate, actionId: number) => {
      // console.log("Before REST Call", timestamp, actionId);
    };

    measurement.on.afterRESTCall = (timestamp: IsoDate, actionId: number, status: string, error: unknown) => {
        // console.log("After REST Call", timestamp, actionId, status, error);
    };

    measurement.on.faceTrackerStateChanged = async (state: FaceTrackerStateType) => {
      trackerState = state;
      if (state === faceTrackerState.LOADED) {
          console.log(measurement.getVersion());
          disableButton('toggle-camera', false);
      }
      if (state === faceTrackerState.READY) {
        disableButton('toggle-measurement', false);
        await measurement.startTracking();
      }
      console.log('faceTrackerStateChanged', state);
    };

    measurement.on.resultsReceived = (results: Results) => {
        const { points, resultsOrder, finalChunkNumber } = results;
        // Intermediate results
        if (resultsOrder < finalChunkNumber) {
            mask.setIntermediateResults(points);
            const pointList = Object.keys(points);
            const IntermediateResults: {[key: string]: string} = {};
            if (pointList.includes('SNR')) IntermediateResults.SNR = points.SNR.value;
            if (pointList.includes('HR_BPM')) IntermediateResults.HR_BPM = points.HR_BPM.value;
            console.log('Intermediate results', IntermediateResults);
        }
        // Final results
        if (resultsOrder === finalChunkNumber) {
            console.log('Final results', results);
        }
    }

    measurement.on.constraintsUpdated = (feedback: ConstraintFeedback, status: ConstraintStatus) => {
      // console.log("Constraints Updated", feedback, status);
    };

    measurement.on.chunkSent = (chunk: ChunkSent) => {
        // console.log('Chunk Sent', chunk);
    };

    measurement.on.facialLandmarksUpdated = (drawables: Drawables) => {
        if(drawables.face.detected) {
            mask.draw(drawables);
        } else {
            console.log('No face detected');
        }
    }

    measurement.on.mediaElementResize = (event: MediaElementResizeEvent) => {
        mask.resize(event.detail);
        console.log('mediaElementResize', event);
    }
    
    try {
        const lambdaUrl = "https://c77ohoqqqpq5i2n5mbngnit6cy0lwqgu.lambda-url.us-east-1.on.aws/";
        const response = await fetch(lambdaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            license: "a632d426-355b-4b2a-956c-08250c8e6a2d"
          })
        });
      
        const data = await response.json();
        console.log("🧾 Lambda Response:", data);
      
        // ✅ Use hardcoded Study ID for now
        const studyId = "7930962e-1e47-4230-a3bf-7ffea2fa0726";
      
        if (response.ok && data.token && data.refreshToken) {
          console.log("✅ Preparing with Study ID:", studyId);
          await measurement.prepare(data.token, data.refreshToken, studyId);
          await measurement.downloadAssets();
        } else {
          console.error("❌ Failed to prepare measurement:", data);
        }
      
      } catch (err) {
        console.error("🔥 Lambda call failed:", err);
      }
      
      

}