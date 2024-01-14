chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    let exampleRule = {
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostEquals: 'canvas.wpi.edu',
          },
        }),
      ],
      actions: [new chrome.declarativeContent.ShowAction()],
    };

    let rules = [exampleRule];
    chrome.declarativeContent.onPageChanged.addRules(rules);
  });
});

chrome.runtime.onMessage.addListener(async (message) => {
  // console.log(message);
  if (message.action === 'DOWNLOAD_BUTTON_CLICKED') {
    const url = new URL((await getCurrentTab()).url);
    const path = url.pathname.split('/');
    const coursesIdx = path.indexOf('courses');
    const courseId = path[coursesIdx + 1];

    if (coursesIdx === -1 && !courseId) {
      // treat it as dashboard
      const dashboard = url.origin + "/api/v1/dashboard/dashboard_cards?per_page=100";
      const dashboardResponse = await fetch(dashboard);
      const dashboardJson = await dashboardResponse.json();

      dashboardJson.forEach(course => {
        console.log(`${url.origin}, ${course.id}, ${course.shortName.trim()}, ${course.term}, ${message.options}`)
        getFilesFromCourseId(url.origin, course.id, course.shortName.trim(), course.term, message.options);
      });


    } else {
      let archive = [];

      if (message.options.files) {
        await filesFromFiles(url.origin, courseId, archive);
      }
      if (message.options.modules) {
        await filesFromModules(url.origin, courseId, archive);
      }

      await fetchAndDownload(archive, courseId);
      // console.log(archive);
    }

  }
});

function slugify(title) {
  return title
    .trim()
    .replace(/ +/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
}

async function filesFromFiles(origin, courseId, archive) {
  const files = await getFilesFiles(origin, courseId);
  for (const file of files) {
    archive.push(file);
  }
}

async function filesFromModules(origin, courseId, archive) {
  const modules = await getModules(origin, courseId);
  const moduleItems = await getModuleItems(modules);
  const moduleFiles = await getModuleFiles(moduleItems);

  modules.forEach((module, i) => {
    const mFiles = moduleFiles[i];
    for (const file of mFiles) {
      archive.push({
        fileName: 'modules/' + slugify(module.name) + '/' + file.filename,
        fileUrl: file.url,
      });
    }
  });
}

async function fetchAndDownload(archive, courseId) {
  archive.forEach((file) => {
    chrome.downloads.download({
      url: file.fileUrl,
      filename: `${slugify(courseId)}/${slugify(file.filename)}`
    });
  });
}

async function fetchAndDownloadDashboard(archive, courseName, term) {
  archive.forEach((file) => {
    console.log(`${slugify(term)}/${slugify(courseName)}/${file.fileName}`)
    chrome.downloads.download({
      url: file.fileUrl,
      filename: `${slugify(term)}/${slugify(courseName)}/${file.fileName}`
    });
  });
}


async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

async function getFilesFromCourseId(origin, courseId, name, term, options) {
  let archive = [];

  if (options.files) {
    await filesFromFiles(origin, courseId, archive);
  }
  if (options.modules) {
    await filesFromModules(origin, courseId, archive);
  }
  console.log(archive);
  await fetchAndDownloadDashboard(archive, name, term);
}

async function getFilesFiles(urlOrigin, courseId) {
  const filesUrl = urlOrigin + `/api/v1/courses/${courseId}/files`;
  let filesResponse = await fetch(filesUrl);
  if (!filesResponse.ok) {
    return [];
  }
  let files = await filesResponse.json();
  let fileObjectList = [];
  files.forEach((element) => {
    fileObjectList.push(fileObjectHandler(element));
  });
  return fileObjectList;
}

function fileObjectHandler(fileObject) {
  let fileName = 'files/' + fileObject.filename;
  let fileUrl = fileObject.url;
  return { fileName, fileUrl };
}

async function getModules(origin, courseId) {
  const response = await fetch(
    origin + '/api/v1/courses/' + courseId + '/modules?per_page=100'
  );

  return await response.json();
}

async function getModuleItems(modules) {
  const responses = await Promise.all(
    modules.map((module) => fetch(module['items_url']))
  );

  return await Promise.all(responses.map((response) => response.json()));
}
async function getModuleFiles(items) {
  const files = [];
  for (const item of items) {
    const fileItems = item.filter((item) => item.type === 'File');
    const responses = await Promise.all(
      fileItems.map((fileItem) => fetch(fileItem['url']))
    );

    const fileData = await Promise.all(
      responses.map(async (response) => await response.json())
    );

    files.push(fileData);
  }

  return files;
}
