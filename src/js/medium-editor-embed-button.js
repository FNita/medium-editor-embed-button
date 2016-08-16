/**
 * Created by orhanveli on 15/08/16.
 */

(function (window, document, MediumEditor) {
    "use strict";

    if (typeof MediumEditor !== "function") {
        throw new Error("Medium Editor is not loaded on the page.");
    }

    var embedButton = {
        "name": "embedButton",
        "action": "embedAction",
        "contentDefault": "E",
        "contentFA": '<i class="fa fa-youtube-play"></i>',
        "aria": "Embed media",

        "defaults": {
            "msgSelectOnlyUrl": "Seçtiğiniz metin geçerli bir URL değil!",
            "msgSelectOnlyEmbadableUrl": "Seçtiğiniz URL desteklenmiyor!",
            "oembedProxy": "http://iframe.ly/api/oembed?api_key=APIKEY_HERE&url=",
            "cssEmbedOverlay": "medium-editor-embeds-overlay",
            "cssEmbeds": "medium-editor-embeds",
            "cssSelected": "medium-editor-embeds-selected",
            "instagramEmbedScript": "//platform.instagram.com/en_US/embeds.js",
            "twitterEmbedScripts": "//platform.twitter.com/widgets.js",
            "facebookEmbedScripts": "//connect.facebook.net/en_US/sdk.js",
            "youtubeEmbedScripts": "",
            "vimeoEmbedScripts": ""
        },

        "init": function() {
            MediumEditor.extensions.button.prototype.init.call(this);
            this.opts = MediumEditor.util.extend({}, this.defaults, this.embedOpts);

            var self = this,
                doc = self.document,
                $embeds = doc.querySelectorAll("." + self.opts.cssEmbeds);


            for (var i = 0; i < $embeds.length; i++) {
                var $elem = $embeds[i];
                $elem.setAttribute("contenteditable", false);
                if ($elem.querySelector("." + self.opts.cssEmbedOverlay) === null) {
                    self.appendOverlay($elem);
                }
            }

            this.base._originalSerializerPreEmbeds = self.base.serialize;
            this.base.serialize = self.embedSerialize;

            this.attachEvents();
        },

        "attachEvents": function() {
            this.on(this.document, "click", this.unselectEmbed.bind(this));
            var $allEmbeds = this.document.querySelectorAll("." + this.opts.cssEmbedOverlay);
            this.on($allEmbeds,
                "click",
                this.selectEmbed.bind(this));

            if($allEmbeds !== null) {
            }
            this.on(this.document, "keydown", this.removeEmbed.bind(this));
            this.on(this.base.elements, "keydown", this.deleteEmbedOnBackspaceAndDel.bind(this));
        },

        "ajaxGet": function(url, callback, failCallback) {
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.onreadystatechange = function() {
                if (xmlhttp.readyState === XMLHttpRequest.DONE) {
                    if (xmlhttp.status === 200) {
                        callback.apply(xmlhttp, [JSON.parse(xmlhttp.responseText)]);
                    } else if (xmlhttp.status === 400) {
                        //console.log('There was an error 400');
                    } else {
                        //console.log('something else other than 200 was returned');
                        if (typeof failCallback !== "undefined") {
                            failCallback.apply(xmlhttp);
                        }
                    }
                }
            };

            xmlhttp.open("GET", url, true);
            xmlhttp.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            xmlhttp.setRequestHeader("Access-Control-Allow-Origin", "*");
            xmlhttp.setRequestHeader("Referrer", document.location.href);
            xmlhttp.send();
            return xmlhttp;
        },

        "handleClick": function(e) {
            e.preventDefault();
            e.stopPropagation();
            var self = this;

            var range = MediumEditor.selection.getSelectionRange(self.document);

            if (range.startContainer.nodeName.toLowerCase() === "a" ||
                range.endContainer.nodeName.toLowerCase() === "a" ||
                MediumEditor.util.getClosestTag(MediumEditor.selection.getSelectedParentElement(range), "a")) {
                return self.execAction("unlink");
            }

            if (range.startContainer.nodeName.toLowerCase() !== "#text" &&
                range.endContainer.nodeName.toLowerCase() !== "#text") {
                alert(self.opts.msgSelectOnlyUrl);
                return false;
            }

            var selectedText = this.getSelection();

            if (selectedText.indexOf("http") < 0) {
                alert(self.opts.msgSelectOnlyUrl);
                return false;
            }

            self.ajaxGet(self.opts.oembedProxy + selectedText,
                function(data) {
                    self.insertEmbed(data);
                });

            self.base.checkContentChanged();
        },

        "getSelection": function() {
            var txt = "";
            if (window.getSelection) {
                txt = window.getSelection().toString();
            } else if (document.getSelection) {
                txt = document.getSelection().toString();
            } else if (document.selection) {
                txt = document.selection.createRange().text;
            }
            return txt;
        },

        "appendOverlay": function($elem) {
            var $overlay = this.document.createElement("div");
            $overlay.className = this.opts.cssEmbedOverlay;
            $elem.appendChild($overlay);
        },

        "insertEmbed": function(data) {
            var self = this,
                id = MediumEditor.util.guid(),
                $wrapper = self.document.createElement("div");

            $wrapper.setAttribute("id", id);
            $wrapper.setAttribute("contenteditable", false);
            $wrapper.className = self.opts.cssEmbeds;
            $wrapper.innerHTML = data.html;
            self.appendOverlay($wrapper);
            self.base.pasteHTML(self.getHtml($wrapper),
                {
                    cleanAttrs: [],
                    cleanTags: []
                });
            this.on(self.document.getElementById(id), "click", this.selectEmbed.bind(this));

            if (data.url.indexOf("instagr") > -1) {
                if (typeof (window.instgrm) === "undefined") {
                    self.injectScript(self.opts.instagramEmbedScript);
                    return;
                }
                window.instgrm.Embeds.process();
            } else if (data.url.indexOf("facebook") > -1 && typeof (window.FB) !== 'undefined') {
                setTimeout(function() {
                        window.FB.XFBML.parse();
                    },
                    1500);
            } else if (data.url.indexOf("twitter") > -1) {
                if (typeof (window.twttr) === "undefined") {
                    self.injectScript(self.opts.twitterEmbedScripts);
                    return;
                }
                window.twttr.widgets.load();
            }

        },

        "selectEmbed": function(e) {
            e.preventDefault();
            e.stopPropagation();
            var self = this,
                $target = e.target,
                $parent = $target.parentElement;

            if ($parent.classList.contains(self.opts.cssSelected)) {
                return;
            }

            var $alreadySelected = self.document.querySelectorAll("." + self.opts.cssEmbeds);
            if (typeof $alreadySelected !== "undefined" && $alreadySelected !== null) {
                $alreadySelected.forEach(function(elem) {
                    elem.classList.remove(self.opts.cssSelected);
                });
            }

            $parent.classList.add(self.opts.cssSelected);
        },

        "unselectEmbed": function(e) {
            var self = this,
                $target = e.target,
                $embeds = self.document.querySelectorAll("." + self.opts.cssEmbeds);

            if ($embeds.length === 0) {
                return false;
            }

            if ($target.classList.contains(self.opts.cssEmbedOverlay)) {
                return false;
            }

            //clear all selecteds
            for (var i = 0; i < $embeds.length; i++) {
                var $elem = $embeds[i];
                $elem.classList.remove(self.opts.cssSelected);
            }
        },

        "removeEmbed": function(e) {
            var $embed,
                self = this;

            if (!MediumEditor.util.isKey(e, [MediumEditor.util.keyCode.BACKSPACE, MediumEditor.util.keyCode.DELETE])) {
                return;
            }

            $embed = self.document.querySelector("." + self.opts.cssSelected);

            if ($embed === null) {
                return;
            }

            e.preventDefault();

            var p = self.document.createElement("p");
            $embed.parentElement.insertBefore(p, $embed);
            $embed.parentElement.removeChild($embed);
        },

        "deleteEmbedOnBackspaceAndDel": function(e) {
            if (!MediumEditor.util.isKey(e, [MediumEditor.util.keyCode.DELETE, MediumEditor.util.keyCode.BACKSPACE])) {
                return;
            }

            var $current = MediumEditor.selection.getSelectionStart(this.base.options.ownerDocument),
                self = this,
                range = MediumEditor.selection.getSelectionRange(self.document),
                p = MediumEditor.util.getClosestTag(MediumEditor.selection.getSelectedParentElement(range), "p"),
                caretOffsets = MediumEditor.selection.getCaretOffsets($current);

            if (caretOffsets.left > 0) {
                return;
            }

            var $isEmbed = p.previousSibling;

            if (typeof $isEmbed === "undefined" ||
                typeof $isEmbed.classList === "undefined" ||
                !$isEmbed.classList.contains(self.opts.cssEmbeds)) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            var newP = self.document.createElement("p");
            $isEmbed.parentElement.insertBefore(newP, $isEmbed);
            $isEmbed.parentElement.removeChild($isEmbed);
        },

        "embedSerialize": function() {
            var self = this,
                data = self._originalSerializerPreEmbeds(),
                doc = self.options.ownerDocument,
                embedExtension = self.getExtensionByName("embedButton");

            for (var key in data) {
                // skip loop if the property is from prototype
                if (!data.hasOwnProperty(key)) continue;

                var obj = data[key];

                var $data = doc.createElement("div");
                $data.innerHTML = obj.value;

                var $embeds = $data.querySelectorAll("." + embedExtension.opts.cssEmbeds);
                if ($embeds !== null) {
                    $embeds.forEach(function ($embed) {
                        $embed.removeAttribute("contenteditable");
                        $embed.classList.remove(embedExtension.opts.cssSelected);
                        var $overlay = $embed.querySelector("." + embedExtension.opts.cssEmbedOverlay);
                        if ($overlay !== null) {
                            $overlay.parentElement.removeChild($overlay);
                        }
                    });
                }
                data[key].value = $data.innerHTML;
            }

            return data;
        },

        "getHtml": function($elem) {
            var $wrap = this.document.createElement("div");
            $wrap.appendChild($elem.cloneNode(true));
            return $wrap.innerHTML;
        },

        "injectScript": function(url) {
            var script = this.document.createElement("script");
            script.type = "text/javascript";
            script.async = true;
            script.onLoad = function() {
            };
            script.src = this.document.location.protocol + url;
            this.document.getElementsByTagName("head")[0].appendChild(script);
        }

    };

    window.EmbedButtonExtension = MediumEditor.extensions.button.extend(embedButton);
}(window, document, MediumEditor));

