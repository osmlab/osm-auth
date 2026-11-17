# Lessons

## Check a change against how iD and Rapid use osm-auth

Before changing an error, an option or a callback, read how the two main callers use it (iD's
`modules/services/osm.js` and `modules/core/uploader.ts` on `develop`; Rapid's
`modules/services/OsmService.ts`). Making every error an `OSMAuthError` looked safe until iD's
`err.message || err.responseText` turned out to depend on the error having no `message` (#180).

## Search closed issues and PRs before filing or fixing

#170 asked for `URLSearchParams`, which #146 had proposed and been closed for. The bug hunt found
real reasons to change our minds, but the PR should have credited #146 from the start.

## Mutation-test a new stub

A test stub that's looser than the browser lets real bugs through. Before trusting one, break the
code in ways the browser would catch (e.g. remove the readyState check, set headers before `open`)
and make sure the suite fails.
