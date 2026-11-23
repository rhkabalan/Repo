using Athar.Game;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Athar.Rendering
{
    /// <summary>
    /// URP post-processing for the desert look: ACES tonemapping, warm grading, soft bloom
    /// on lamps and sunlit plaster, a light vignette, and SMAA.
    /// </summary>
    public static class PostFx
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Register() => AtharGame.ConfigureCamera = Configure;

        static void Configure(Camera cam)
        {
            var data = cam.GetUniversalAdditionalCameraData();
            if (data == null) return;
            data.renderPostProcessing = true;
            data.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            data.antialiasingQuality = AntialiasingQuality.High;
            data.renderShadows = true;

            var go = new GameObject("PostFx");
            var volume = go.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 10;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            volume.sharedProfile = profile;

            var tone = profile.Add<Tonemapping>(true);
            tone.mode.Override(TonemappingMode.ACES);

            var bloom = profile.Add<Bloom>(true);
            bloom.threshold.Override(1.0f);
            bloom.intensity.Override(0.55f);
            bloom.scatter.Override(0.65f);
            bloom.tint.Override(new Color(1f, 0.86f, 0.66f));

            var color = profile.Add<ColorAdjustments>(true);
            color.postExposure.Override(0.25f);
            color.contrast.Override(12f);
            color.saturation.Override(6f);
            color.colorFilter.Override(new Color(1f, 0.96f, 0.9f));

            var wb = profile.Add<WhiteBalance>(true);
            wb.temperature.Override(10f);

            var vignette = profile.Add<Vignette>(true);
            vignette.intensity.Override(0.22f);
            vignette.smoothness.Override(0.45f);
        }
    }
}
