using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Athar.EditorTools
{
    /// <summary>
    /// Command-line builds (used by CI): runs the project setup, then builds the active target.
    ///   Unity -batchmode -quit -projectPath unity/ATHAR -buildTarget WebGL
    ///         -executeMethod Athar.EditorTools.AtharBuild.Build -customBuildPath build/WebGL
    /// </summary>
    public static class AtharBuild
    {
        public static void Build()
        {
            AtharSetup.Run();
            var target = EditorUserBuildSettings.activeBuildTarget;
            var output = Arg("-customBuildPath") ?? Path.Combine("Build", target.ToString());
            if (target == BuildTarget.Android && !output.EndsWith(".apk") && !output.EndsWith(".aab")) output = Path.Combine(output, "ATHAR.apk");
            if ((target == BuildTarget.StandaloneWindows64 || target == BuildTarget.StandaloneWindows) && !output.EndsWith(".exe")) output = Path.Combine(output, "ATHAR.exe");
            if (target == BuildTarget.StandaloneOSX && !output.EndsWith(".app")) output = Path.Combine(output, "ATHAR.app");

            var options = new BuildPlayerOptions
            {
                scenes = new[] { "Assets/ATHAR/Scenes/Mecca.unity" },
                locationPathName = output,
                target = target,
                options = BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log($"ATHAR build {report.summary.result}: {output} ({report.summary.totalSize / 1048576f:F1} MB)");
            if (report.summary.result != BuildResult.Succeeded) EditorApplication.Exit(1);
        }

        [MenuItem("ATHAR/Build/WebGL")] static void WebGL() => BuildFor(BuildTarget.WebGL, BuildTargetGroup.WebGL);
        [MenuItem("ATHAR/Build/Android")] static void Android() => BuildFor(BuildTarget.Android, BuildTargetGroup.Android);
        [MenuItem("ATHAR/Build/Windows")] static void Windows() => BuildFor(BuildTarget.StandaloneWindows64, BuildTargetGroup.Standalone);

        static void BuildFor(BuildTarget target, BuildTargetGroup group)
        {
            if (EditorUserBuildSettings.activeBuildTarget != target) EditorUserBuildSettings.SwitchActiveBuildTarget(group, target);
            Build();
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == name) return args[i + 1];
            return null;
        }
    }
}
