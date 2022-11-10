


for commit in Repository('https://github.com/rhkabalan/Repo.git').traverse_commits():
    print('Hash {}, author {}'.format(commit.hash, commit.author.name))
urls = ["https://github.com/microsoft/mixed-reality-extension-unity.git","https://github.com/microsoft/MixedReality-WebRTC.git","https://github.com/microsoft/MixedRealityToolkit-Unity.git"]
for commit in Repository(path_to_repo=urls).traverse_commits():
    print("Project {}, commit {}, date {}".format(commit.project_path, commit.hash, commit.author_date))
