/*jslint todo: true */
/*global $, console, jQuery*/
/*jslint browser:true */
/*jslint plusplus: true */
"use strict";
var sections;
var section;
var sectionTimes;

function processSessionLectures(session, courseObject) {
    var sectionList = document.createElement("ul");
    $.each(session.lectures, function (i, lecture) {
        if (lecture.section.charAt(1) !== "2" && lecture.time !== "Online Web Version") {
            section = document.createElement("li");
            sectionTimes = lecture.times;
            section.appendChild(document.createTextNode(lecture.section));
            if (courseObject.manualTutorialEnrolment === false && session.tutorials.length > 0) {
                sectionTimes = sectionTimes.concat(session.tutorials[i]);
            }
            setSectionMouseEvents(section, sectionTimes, courseObject);
            sectionList.appendChild(section);
        }
    });
    return sectionList;
}

function processSessionTutorials(session, courseObject, sectionList) {
    $.each(session.tutorials, function (i, tutorial) {
        if (courseObject.manualTutorialEnrolment) {
            section = document.createElement("li");
            sectionTimes = tutorial[1];
            section.appendChild(document.createTextNode(tutorial[0]));
            setSectionMouseEvents(section, sectionTimes, courseObject);
            sectionList.appendChild(section);
        }
    });
    return sectionList;
}

function processSession(courseObject) {
    var sectionList;
    sections = document.createElement("div");
    sections.setAttribute("class", "sections");
    if (typeof courseObject.Y !== "undefined") {  
        sectionList = document.createElement("ul");  
        sectionList = processSessionLectures(courseObject.Y, courseObject);
        sectionList = processSessionTutorials(courseObject.Y, courseObject, sectionList);
        $(sectionList).attr("class", "sectionList-year");
        sections.appendChild(sectionList);
    } else {
        if (typeof courseObject.F !== "undefined") {
            sectionList = document.createElement("ul");
            sectionList = processSessionLectures(courseObject.F, courseObject);
            sectionList = processSessionTutorials(courseObject.F, courseObject, sectionList);
            $(sectionList).attr("class", "sectionList-fall");
            sections.appendChild(sectionList);
        }
        if (typeof courseObject.S !== "undefined") { 
            sectionList = document.createElement("ul");
            sectionList = processSessionLectures(courseObject.S, courseObject);
            sectionList = processSessionTutorials(courseObject.S, courseObject, sectionList);
            $(sectionList).attr("class", "sectionList-spring");
            sections.appendChild(sectionList);
        }
    }
    return sections;
}