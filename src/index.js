import jiraClient from 'jira-client';
import fs from 'fs';
import {
  finished
} from 'stream/promises';
import {
  Readable
} from 'stream';

class Import {
  #config;
  #project;
  #api;
  #blockLinkType;

  async run() {
    this.#readConfig();

    await this.#jiraConfig();

    await this.#importAddons();
    await this.#importCollections();
    await this.#importRatings();
    await this.#importUsers();
    await this.#importReports();
  }

  async #apiRequest(pathname) {
    return this.#api.doRequest(this.#api.makeRequestHeader(this.#api.makeUri({
      pathname
    }), {}));
  }

  #readConfig() {
    console.log("Reading config file...");
    this.#config = JSON.parse(fs.readFileSync("config.json"));
  }

  async #jiraConfig() {
    console.log("Connecting to jira...");
    this.#api = new jiraClient(this.#config.jira);

    console.log("Retrive project details...");
    const data = await this.#api.getIssueCreateMetadata({
      issuetypeNames: ["AMO Addon", "AMO Collection", "AMO Rating", "AMO User", "AMO Report"],
      expand: 'projects.issuetypes.fields'
    });

    this.#project = data.projects.find(p => p.key === this.#config.project);
    if (!this.#project) {
      throw new Error("Invalid project");
    }

    this.#blockLinkType = (await this.#api.listIssueLinkTypes()).issueLinkTypes.find(a => a.name === "Blocks");
  }

  async #importRatings() {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO Rating");
    if (!issueType) {
      throw new Error("No AMO Rating type!");
    }

    console.log("Importing AMO Ratings...");
    const items = [];
    while (items.length < this.#config.cinder_limit) {
      const data = await fetch(`${this.#config.cinder_url}/api/v1/graph/entity/amo_rating/?limit=100&offset=${items.length}`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#config.cinder_token}`
        }
      }).then(a => a.json());

      if (!data.items.length) {
        break;
      }

      for (const item of data.items) {
        items.push(item);
      }
    }

    // This part can be removed if we make Rating name searcheable.
    console.log("Retrieve all the existing AMO Ratings...");
    const allTheIssues = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO Rating"`);

    for (const item of items) {
      await this.#importRating(allTheIssues, issueType, item);
    }
  }

  async #importReports() {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO Report");
    if (!issueType) {
      throw new Error("No AMO Report type!");
    }

    console.log("Importing AMO Reports...");
    const items = [];
    while (items.length < this.#config.cinder_limit) {
      const data = await fetch(`${this.#config.cinder_url}/api/v1/graph/entity/amo_report/?limit=100&offset=${items.length}`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#config.cinder_token}`
        }
      }).then(a => a.json());

      if (!data.items.length) {
        break;
      }

      for (const item of data.items) {
        items.push(item);
      }
    }

    // This part can be removed if we make Report name searcheable.
    console.log("Retrieve all the existing AMO Reports...");
    const allTheIssues = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO Report"`);
    const allTheAddons = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO Addon"`);
    const allTheUsers = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO User"`);

    for (const item of items) {
      await this.#importReport(allTheIssues, allTheAddons, allTheUsers, issueType, item);
    }
  }

  async #importUsers() {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO User");
    if (!issueType) {
      throw new Error("No AMO User type!");
    }

    console.log("Importing AMO Users...");
    const items = [];
    while (items.length < this.#config.cinder_limit) {
      const data = await fetch(`${this.#config.cinder_url}/api/v1/graph/entity/amo_user/?limit=100&offset=${items.length}`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#config.cinder_token}`
        }
      }).then(a => a.json());

      if (!data.items.length) {
        break;
      }

      for (const item of data.items) {
        items.push(item);
      }
    }

    // This part can be removed if we make User name searcheable.
    console.log("Retrieve all the existing AMO Users...");
    const allTheIssues = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO User"`);

    for (const item of items) {
      await this.#importUser(allTheIssues, issueType, item);
    }
  }

  async #importCollections() {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO Collection");
    if (!issueType) {
      throw new Error("No AMO Collection type!");
    }

    console.log("Importing AMO Collections...");
    const items = [];
    while (items.length < this.#config.cinder_limit) {
      const data = await fetch(`${this.#config.cinder_url}/api/v1/graph/entity/amo_collection/?limit=100&offset=${items.length}`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#config.cinder_token}`
        }
      }).then(a => a.json());

      if (!data.items.length) {
        break;
      }

      for (const item of data.items) {
        items.push(item);
      }
    }

    // This part can be removed if we make Collection name searcheable.
    console.log("Retrieve all the existing AMO Collections...");
    const allTheIssues = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO Collection"`);

    for (const item of items) {
      await this.#importCollection(allTheIssues, issueType, item);
    }
  }

  async #importAddons() {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO Addon");
    if (!issueType) {
      throw new Error("No AMO Addon type!");
    }

    console.log("Importing AMO Addons...");
    const items = [];
    while (items.length < this.#config.cinder_limit) {
      const data = await fetch(`${this.#config.cinder_url}/api/v1/graph/entity/amo_addon/?limit=100&offset=${items.length}`, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#config.cinder_token}`
        }
      }).then(a => a.json());

      if (!data.items.length) {
        break;
      }

      for (const item of data.items) {
        items.push(item);
      }
    }

    // This part can be removed if we make Addon ID searcheable.
    console.log("Retrieve all the existing AMO Addons...");
    const allTheIssues = await this.#query(`PROJECT = "${this.#config.project}" AND TYPE = "AMO Addon"`);

    for (const item of items) {
      await this.#importAddon(allTheIssues, issueType, item);
    }
  }

  async #importReport(allTheIssues, allTheAddons, allTheUsers, issueType, item) {
    const summaryID = Object.entries(issueType.fields).find(entry => entry[1].name === "Summary");
    if (!summaryID) throw new Error("Unable to find the custom field 'FxA ID'");

    const fields = {
      summary: item.attributes.id,
    };

    const attrMap = {
      "summary": "Summary",
      "reason": "Reason",
      "locale": "Locale",
      "message": "Description",
      "created": "Creation Date",
    };

    for (const attr of Object.keys(item.attributes)) {
      if (!item.attributes[attr]) continue;

      if (["id", "slug", "summary",
          /* WHY: */
        ].includes(attr)) continue;

      if (!attrMap[attr]) {
        throw new Error(`Unknown attribute for AMO Addon: ${attr}`);
      }

      const field = Object.entries(issueType.fields).find(entry => entry[1].name === attrMap[attr]);
      if (!field) {
        throw new Error(`Unknown jira attribute for AMO Addon: ${attr}`);
      }

      fields[field[0]] = item.attributes[attr];
    }

    // Special limitation for summary
    fields.summary = fields.summary.slice(0, 255);

    let issueData = allTheIssues.find(a => a.fields[summaryID[0]] === item.attributes.id);
    if (issueData) {
      console.log(" -> Updating issue", issueData.key);
      await this.#api.updateIssue(issueData.id, {
        fields
      });
    } else {
      const issue = {
        fields: {
          project: {
            key: this.#project.key
          },
          issuetype: {
            id: issueType.id
          }
        }
      };

      issue.fields = {
        ...fields,
        ...issue.fields
      };
      issueData = await this.#api.addNewIssue(issue);
      console.log(" -> Creating issue", issueData.key);
    }

    const rels = await fetch(`${this.#config.cinder_url}/api/v1/graph/entity/amo_report/${item.attributes.id}/related_entities/?relationship_type=amo_report_of`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.#config.cinder_token}`
      }
    }).then(a => a.json());

    for (const rel of rels.items) {
      switch (rel.entity_type) {
        case "amo_addon":
          await this.#linkReportToAddon(issueData.id, rel.attributes.guid, allTheAddons);
          break;

        case "amo_user":
          await this.#linkReportToUser(issueData.id, rel.attributes.fxa_id, allTheUsers);
          break;

        case "amo_collection":
          // TODO
          break;

        case "amo_rating":
          // TODO
          break;

        default:
          console.log("UNSUPPORTED", rel.entity_type);
          break;
      }
    }
  }

  async #linkReportToAddon(reportID, addonID, allTheAddons) {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO Addon");
    if (!issueType) throw new Error("No AMO Addon type!");

    const addonIdName = Object.entries(issueType.fields).find(entry => entry[1].name === "Addon ID");
    if (!addonIdName) throw new Error("Unable to find the custom field 'Addon ID'");

    const issueData = allTheAddons.find(a => a.fields[addonIdName[0]] === addonID);
    if (!issueData) {
      console.log(`Unable to find addon ${addonID}`);
      return;
    }

    await this.#linkIssues(reportID, issueData.id);
  }

  async #linkReportToUser(reportID, userID, allTheAddons) {
    const issueType = this.#project.issuetypes.find(i => i.name === "AMO User");
    if (!issueType) throw new Error("No AMO User type!");

    const fxaID = Object.entries(issueType.fields).find(entry => entry[1].name === "FxA ID");
    if (!fxaID) throw new Error("Unable to find the custom field 'FxA ID'");

    const issueData = allTheAddons.find(a => a.fields[fxaID[0]] === userID);
    if (!issueData) {
      console.log(`Unable to find user ${userID}`);
      return;
    }

    await this.#linkIssues(reportID, issueData.id);
  }

  async #linkIssues(a, b) {
    return this.#api.issueLink({
      inwardIssue: {
        id: a
      },
      outwardIssue: {
        id: b
      },
      type: this.#blockLinkType
    });
  }

  async #importUser(allTheIssues, issueType, item) {
    const fxaID = Object.entries(issueType.fields).find(entry => entry[1].name === "FxA ID");
    if (!fxaID) throw new Error("Unable to find the custom field 'FxA ID'");

    const fields = {
      summary: item.attributes.id,
    };

    const attrMap = {
      "summary": "Summary",
      "name": "Name",
      "fxa_id": "FxA ID",
      "email": "Email",
      "created": "Creation Date",
      "occupation": "Occupation",
      "location": "Location",
      "biography": "Biography",
      "num_addons_listed": "Number Addons Listed",
      "homepage": "Homepage URL",
    };

    for (const attr of Object.keys(item.attributes)) {
      if (!item.attributes[attr]) continue;

      if (["id", "slug",
          /* WHY: */
          "average_rating",
          "avatar",
        ].includes(attr)) continue;

      if (!attrMap[attr]) {
        throw new Error(`Unknown attribute for AMO Addon: ${attr}`);
      }

      const field = Object.entries(issueType.fields).find(entry => entry[1].name === attrMap[attr]);
      if (!field) {
        throw new Error(`Unknown jira attribute for AMO Addon: ${attr}`);
      }

      fields[field[0]] = item.attributes[attr];
    }

    // Special limitation for summary
    fields.summary = fields.summary.slice(0, 255);

    let issueData = allTheIssues.find(a => a.fields[fxaID[0]] === item.attributes.id);
    if (issueData) {
      console.log(" -> Updating issue", issueData.key);
      await this.#api.updateIssue(issueData.id, {
        fields
      });
    } else {
      const issue = {
        fields: {
          project: {
            key: this.#project.key
          },
          issuetype: {
            id: issueType.id
          }
        }
      };

      issue.fields = {
        ...fields,
        ...issue.fields
      };
      issueData = await this.#api.addNewIssue(issue);
      console.log(" -> Creating issue", issueData.key);
    }

    try {
      issueData = await this.#api.findIssue(issueData.id);
      for (const attachment of issueData.fields.attachment || []) {
        await this.#api.deleteAttachment(attachment.id);
      }

      if (item.attributes.avatar) {
        console.log(" --> attach for", issueData.key);
        const res = await fetch(item.attributes.avatar.value);

        const fileName = this.#filenameFromMimeType("avatar", item.attributes.avatar.mime_type);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        const fileStream = fs.createWriteStream(fileName, {
          flags: 'wx'
        });
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
        await this.#api.addAttachmentOnIssue(issueData.id, fs.createReadStream(fileName));
      }
    } catch (e) {}
  }

  async #importRating(allTheIssues, issueType, item) {
    const ratingId = Object.entries(issueType.fields).find(entry => entry[1].name === "Rating ID");
    if (!ratingId) throw new Error("Unable to find the custom field 'Rating ID'");

    const fields = {
      summary: item.attributes.id,
    };

    const attrMap = {
      "summary": "Summary",
      "id": "Rating ID",
      "body": "Description",
      "score": "Score",
      "created": "Creation Date",
    };

    for (const attr of Object.keys(item.attributes)) {
      if (!item.attributes[attr]) continue;

      if (["slug", ].includes(attr)) continue;

      if (!attrMap[attr]) {
        throw new Error(`Unknown attribute for AMO Addon: ${attr}`);
      }

      const field = Object.entries(issueType.fields).find(entry => entry[1].name === attrMap[attr]);
      if (!field) {
        throw new Error(`Unknown jira attribute for AMO Addon: ${attr}`);
      }

      fields[field[0]] = item.attributes[attr];
    }

    // Special limitation for summary
    fields.summary = fields.summary.slice(0, 255);

    let issueData = allTheIssues.find(a => a.fields[ratingId[0]] === item.attributes.id);
    if (issueData) {
      console.log(" -> Updating issue", issueData.key);
      await this.#api.updateIssue(issueData.id, {
        fields
      });
    } else {
      const issue = {
        fields: {
          project: {
            key: this.#project.key
          },
          issuetype: {
            id: issueType.id
          }
        }
      };

      issue.fields = {
        ...fields,
        ...issue.fields
      };
      issueData = await this.#api.addNewIssue(issue);
      console.log(" -> Creating issue", issueData.key);
    }
  }

  async #importCollection(allTheIssues, issueType, item) {
    const collectionName = Object.entries(issueType.fields).find(entry => entry[1].name === "Collection Name");
    if (!collectionName) throw new Error("Unable to find the custom field 'Collection Name'");

    const fields = {
      summary: item.attributes.name,
    };

    const attrMap = {
      "summary": "Summary",
      "name": "Collection Name",
      "description": "Description",
      "modified": "Modify Date",
      "created": "Creation Date",
    };

    for (const attr of Object.keys(item.attributes)) {
      if (!item.attributes[attr]) continue;

      if (["id", "slug", /* Because I'm lazy...*/ "comments", ].includes(attr)) continue;

      if (!attrMap[attr]) {
        throw new Error(`Unknown attribute for AMO Addon: ${attr}`);
      }

      const field = Object.entries(issueType.fields).find(entry => entry[1].name === attrMap[attr]);
      if (!field) {
        throw new Error(`Unknown jira attribute for AMO Addon: ${attr}`);
      }

      fields[field[0]] = item.attributes[attr];
    }

    // Special limitation for summary
    fields.summary = fields.summary.slice(0, 255);

    let issueData = allTheIssues.find(a => a.fields[collectionName[0]] === item.attributes.name);
    if (issueData) {
      console.log(" -> Updating issue", issueData.key);
      await this.#api.updateIssue(issueData.id, {
        fields
      });
    } else {
      const issue = {
        fields: {
          project: {
            key: this.#project.key
          },
          issuetype: {
            id: issueType.id
          }
        }
      };

      issue.fields = {
        ...fields,
        ...issue.fields
      };
      issueData = await this.#api.addNewIssue(issue);
      console.log(" -> Creating issue", issueData.key);
    }
  }

  async #importAddon(allTheIssues, issueType, item) {
    const addonIdName = Object.entries(issueType.fields).find(entry => entry[1].name === "Addon ID");
    if (!addonIdName) throw new Error("Unable to find the custom field 'Addon ID'");

    const fields = {
      summary: item.attributes.guid,
    };

    const attrMap = {
      "summary": "Summary",
      "description": "Description",
      "homepage": "Homepage URL",
      "support_url": "Support URL",
      "support_email": "Support Email",
      "guid": "Addon ID",
      "name": "Addon Name",
      "release_notes": "Release Notes",
      "average_daily_users": "Average Daily Users",
      "last_updated": "Last Updated",
      "version": "Version",
      "created": "Creation Date",
      "promoted": "Promoted",
    };

    for (const attr of Object.keys(item.attributes)) {
      if (!item.attributes[attr]) continue;

      if (["id", "slug", "previews", "icon",
          /* WHY: */
          "privacy_policy",
          /* WHY: */
          "promoted_badge",
        ].includes(attr)) continue;

      if (!attrMap[attr]) {
        throw new Error(`Unknown attribute for AMO Addon: ${attr}`);
      }

      const field = Object.entries(issueType.fields).find(entry => entry[1].name === attrMap[attr]);
      if (!field) {
        throw new Error(`Unknown jira attribute for AMO Addon: ${attr}`);
      }

      fields[field[0]] = item.attributes[attr];
    }

    // Special limitation for summary
    fields.summary = fields.summary.slice(0, 255);

    let issueData = allTheIssues.find(a => a.fields[addonIdName[0]] === item.attributes.guid);
    if (issueData) {
      console.log(" -> Updating issue", issueData.key);
      await this.#api.updateIssue(issueData.id, {
        fields
      });
    } else {
      console.log(" -> Creating issue");
      const issue = {
        fields: {
          project: {
            key: this.#project.key
          },
          issuetype: {
            id: issueType.id
          }
        }
      };

      issue.fields = {
        ...fields,
        ...issue.fields
      };
      issueData = await this.#api.addNewIssue(issue);
    }

    issueData = await this.#api.findIssue(issueData.id);
    for (const attachment of issueData.fields.attachment || []) {
      await this.#api.deleteAttachment(attachment.id);
    }

    if (item.attributes.previews && item.attributes.previews.length) {
      for (const i of item.attributes.previews) {
        console.log(" --> attach for", issueData.key);
        const res = await fetch(i.value);

        const fileName = this.#filenameFromMimeType("preview", i.mime_type);
        if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

        const fileStream = fs.createWriteStream(fileName, {
          flags: 'wx'
        });
        await finished(Readable.fromWeb(res.body).pipe(fileStream));
        await this.#api.addAttachmentOnIssue(issueData.id, fs.createReadStream(fileName));
      }
    }

    if (item.attributes.icon) {
      console.log(" --> attach for", issueData.key);
      const res = await fetch(item.attributes.icon.value);

      const fileName = this.#filenameFromMimeType("icon", item.attributes.icon.mime_type);
      if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

      const fileStream = fs.createWriteStream(fileName, {
        flags: 'wx'
      });
      await finished(Readable.fromWeb(res.body).pipe(fileStream));
      await this.#api.addAttachmentOnIssue(issueData.id, fs.createReadStream(fileName));
    }
  }

  #filenameFromMimeType(prefix, mimeType) {
    switch (mimeType) {
      case "image/jpeg":
        return `/tmp/${prefix}.jpeg`;
      case "image/png":
        return `/tmp/${prefix}.png`;
      default:
        console.log(`Unsupported mime/type ${mimeType}`);
        return `/tmp/${prefix}.data`;
    }
  }

  async #query(jql) {
    let results = [];

    while (true) {
      const data = await this.#api.searchJira(jql, {
        startAt: results.length,
        maxResults: 100
      });
      if (data.issues.length === 0) {
        break;
      }
      results = results.concat(data.issues);
    }

    return results;
  }

}

const i = new Import();
i.run();
