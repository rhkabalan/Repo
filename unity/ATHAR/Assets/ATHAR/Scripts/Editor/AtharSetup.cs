using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace Athar.EditorTools
{
    /// <summary>
    /// One-click project setup, run automatically the first time the project opens
    /// (and from ATHAR > Set Up Project): creates the URP pipeline, the material templates
    /// the runtime clones, the UI theme, the bootstrap scene, and the player settings.
    /// The world itself is built in code at runtime, so the scene is nearly empty.
    /// </summary>
    [InitializeOnLoad]
    public static class AtharSetup
    {
        const string Root = "Assets/ATHAR";
        const string Settings = Root + "/Settings";
        const string Materials = Root + "/Resources/Materials";
        const string UiDir = Root + "/Resources/UI";
        const string ScenePath = Root + "/Scenes/Mecca.unity";
        const string PipelinePath = Settings + "/AtharURP.asset";
        const string RendererPath = Settings + "/AtharURP_Renderer.asset";

        static AtharSetup()
        {
            if (Application.isBatchMode) return;
            EditorApplication.delayCall += () =>
            {
                if (File.Exists(PipelinePath) && File.Exists(ScenePath)) return;
                Run();
                EditorSceneManager.OpenScene(ScenePath);
                EditorUtility.DisplayDialog("ATHAR", "Project set up. Press Play to start the Mecca chapter.", "OK");
            };
        }

        [MenuItem("ATHAR/Set Up Project")]
        public static void RunFromMenu()
        {
            Run();
            EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("ATHAR/Reset Saved Progress")]
        public static void ResetProgress()
        {
            var path = Path.Combine(Application.persistentDataPath, "journey.json");
            if (File.Exists(path)) File.Delete(path);
            PlayerPrefs.DeleteKey("athar.name");
            PlayerPrefs.DeleteKey("athar.character");
            Debug.Log("ATHAR: saved progress cleared.");
        }

        public static void Run()
        {
            foreach (var dir in new[] { Settings, Materials, UiDir, Root + "/Scenes" }) Directory.CreateDirectory(dir);
            AssetDatabase.Refresh();
            SetUpPipeline();
            SetUpMaterials();
            SetUpUiTheme();
            SetUpScene();
            SetUpPlayer();
            AssetDatabase.SaveAssets();
            Debug.Log("ATHAR: project set up.");
        }

        // ------------------------------------------------------------ render pipeline
        static void SetUpPipeline()
        {
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
            if (!pipeline)
            {
                var renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, RendererPath);
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(pipeline, PipelinePath);
            }
            pipeline.supportsHDR = true;
            pipeline.shadowDistance = 70;
            pipeline.shadowCascadeCount = 2;
            pipeline.msaaSampleCount = 1; // SMAA on the camera instead; cheaper on phones
            pipeline.renderScale = 1;
            EditorUtility.SetDirty(pipeline);

            GraphicsSettings.defaultRenderPipeline = pipeline;
            int current = QualitySettings.GetQualityLevel();
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = pipeline;
            }
            QualitySettings.SetQualityLevel(current, false);
        }

        // ------------------------------------------------------------ materials
        static Material SaveMaterial(string name, Shader shader, System.Action<Material> configure = null)
        {
            var path = $"{Materials}/{name}.mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (!m) { m = new Material(shader); AssetDatabase.CreateAsset(m, path); }
            else m.shader = shader;
            configure?.Invoke(m);
            EditorUtility.SetDirty(m);
            return m;
        }

        static void SetUpMaterials()
        {
            var lit = Shader.Find("Universal Render Pipeline/Lit");
            var unlit = Shader.Find("Universal Render Pipeline/Unlit");
            SaveMaterial("AtharLit", lit, m => m.SetFloat("_Smoothness", 0.1f));
            SaveMaterial("AtharUnlit", unlit);
            // Not used directly: they keep the emissive and transparent shader variants in builds.
            SaveMaterial("AtharLitEmissive", lit, m => { m.EnableKeyword("_EMISSION"); m.SetColor("_EmissionColor", Color.white); });
            SaveMaterial("AtharUnlitTransparent", unlit, m =>
            {
                m.SetFloat("_Surface", 1); m.SetFloat("_Blend", 0);
                m.SetOverrideTag("RenderType", "Transparent");
                m.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha); m.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
                m.SetInt("_ZWrite", 0); m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
                m.renderQueue = (int)RenderQueue.Transparent;
            });
            SaveMaterial("AtharSky", Shader.Find("Skybox/Procedural"), m =>
            {
                m.SetFloat("_SunSize", 0.05f);
                m.SetFloat("_SunSizeConvergence", 6f);
                m.SetFloat("_AtmosphereThickness", 0.8f);
                m.SetColor("_SkyTint", new Color(0.62f, 0.62f, 0.66f));
                m.SetColor("_GroundColor", new Color(0.55f, 0.43f, 0.31f));
                m.SetFloat("_Exposure", 1.1f);
            });
        }

        // ------------------------------------------------------------ UI theme
        static void SetUpUiTheme()
        {
            var tssPath = UiDir + "/AtharTheme.tss";
            if (!File.Exists(tssPath))
            {
                File.WriteAllText(tssPath, "@import url(\"unity-theme://default\");\n");
                AssetDatabase.ImportAsset(tssPath);
            }
            var theme = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(tssPath);
            var panelPath = UiDir + "/AtharPanel.asset";
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(panelPath);
            if (!panel) { panel = ScriptableObject.CreateInstance<PanelSettings>(); AssetDatabase.CreateAsset(panel, panelPath); }
            panel.themeStyleSheet = theme;
            panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            panel.referenceResolution = new Vector2Int(1280, 760);
            panel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            panel.match = 0.5f;
            EditorUtility.SetDirty(panel);
        }

        // ------------------------------------------------------------ scene
        static void SetUpScene()
        {
            if (!File.Exists(ScenePath))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                var cam = new GameObject("Main Camera") { tag = "MainCamera" };
                cam.AddComponent<Camera>();
                cam.AddComponent<AudioListener>();
                cam.AddComponent<UniversalAdditionalCameraData>();
                // AtharGame boots itself after the scene loads; nothing else is needed here.
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
        }

        // ------------------------------------------------------------ player
        static void SetUpPlayer()
        {
            PlayerSettings.companyName = "ATHAR";
            PlayerSettings.productName = "ATHAR";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, "com.athar.journey");
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.iOS, "com.athar.journey");
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true; // works on static hosts without gzip headers
        }
    }
}
