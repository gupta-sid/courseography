{-# LANGUAGE OverloadedStrings, FlexibleContexts, GADTs, ScopedTypeVariables #-}
module Main where

import Text.XML.HaXml
import Text.XML.HaXml.ByteStringPP
import Text.XML.HaXml.Wrappers
import Text.XML.HaXml.Types
import Text.XML.HaXml.Combinators
import Control.Monad.IO.Class  (liftIO)
import Text.XML.HaXml.Util
import Text.XML.HaXml.XmlContent.Parser
import qualified Data.Conduit.List as CL
import Database.Persist
import Database.Persist.Sqlite
import Text.XML.HaXml.Namespaces
import Data.Conduit
import Data.List.Split
import Data.List
import Data.Text as T (pack, unpack)
import Tables
import JsonParser
import SVGBuilder
import SVGTypes
import ParserUtil

main :: IO ()
main = do graphFile <- readFile "../res/graphs/graph_regions.svg"
          let graphDoc = xmlParse "output.error" graphFile
          parseLevel (Style (0,0) "" "" "" "" "" "") (getRoot graphDoc)
          buildSVG
          printDB

-- | Parses a level.
parseLevel :: Style -> Content i -> IO ()
parseLevel style content = do
    if (getAttribute "id" content) == "layer2" ||
       ((getName content) == "defs")
      then liftIO $ print "Abort"
      else do
           let rects = parseContent (tag "rect") content
           let texts = parseContent (tag "text") content
           let paths = parseContent (tag "path") content
           let ellipses = parseContent (tag "ellipse") content
           let children = getChildren content
           let newTransform = getAttribute "transform" content
           let newStyle = getAttribute "style" content
           let newFill = getNewStyleAttr newStyle "fill" (fill style)
           --let newFill = getStyleAttr "fill" newStyle
           --let fillx = if null newFill then (fill style) else newFill
           --let filly = if fillx == "none" then (fill style) else fillx
           --let fillz = if fillx == "#000000" then "none" else filly
           let newFontSize = getNewStyleAttr newStyle "font-size" (fontSize style)
           let newStroke = getNewStyleAttr newStyle "stroke" (stroke style)
           let newFillOpacity = getNewStyleAttr newStyle "fill-opacity" (fillOpacity style)
           let newFontWeight = getNewStyleAttr newStyle "font-weight" (fontWeight style)
           let newFontFamily = getNewStyleAttr newStyle "font-family" (fontFamily style)
           let x = if null newTransform then (0,0) else parseTransform newTransform
           let adjustedTransform = (fst (transform style) + fst x,
                                    snd (transform style) + snd x)
           let parentStyle = Style adjustedTransform 
                                   newFill  
                                   newFontSize  
                                   newStroke 
                                   newFillOpacity 
                                   newFontWeight
                                   newFontFamily
           parseElements (parseRect parentStyle) rects
           parseElements (parseText parentStyle) texts
           parseElements (parsePath parentStyle) paths
           parseElements (parseEllipse parentStyle) ellipses
           parseChildren parentStyle children

-- | Parses a list of Content.
parseChildren :: Style -> [Content i] -> IO ()
parseChildren _ [] = return ()
parseChildren style (x:xs) =
    do parseLevel style x
       parseChildren style xs

-- | Applies a parser to a list of Content.
parseElements :: (Content i -> IO ()) -> [Content i] -> IO ()
parseElements f [] = return ()
parseElements f (x:xs) = do f x
                            parseElements f xs

-- | Parses a rect.
parseRect :: Style -> Content i -> IO ()
parseRect style content = 
    insertRectIntoDB (getAttribute "id" content)
                     (read $ getAttribute "width" content :: Float)
                     (read $ getAttribute "height" content :: Float)
                     ((read $ getAttribute "x" content :: Float) + fst (transform style))
                     ((read $ getAttribute "y" content :: Float) + snd (transform style))
                     style

-- | Parses a path.
parsePath :: Style -> Content i -> IO ()
parsePath style content = 
    insertPathIntoDB (map (addTransform (transform style)) $ parsePathD $ getAttribute "d" content)
                     style

-- | Parses a text.
parseText :: Style -> Content i -> IO ()
parseText style content = 
    insertTextIntoDB (getAttribute "id" content)
                     ((read $ getAttribute "x" content :: Float) + fst (transform style))
                     ((read $ getAttribute "y" content :: Float) + snd (transform style))
                     (tagTextContent content)
                     style

-- | Parses a text.
parseEllipse :: Style -> Content i -> IO ()
parseEllipse style content = 
    insertEllipseIntoDB ((read $ getAttribute "cx" content :: Float) + fst (transform style))
                        ((read $ getAttribute "cy" content :: Float) + snd (transform style))
                        (fill style)

insertEllipseIntoDB :: Float -> Float -> String -> IO ()
insertEllipseIntoDB xPos yPos stroke = 
    runSqlite dbStr $ do
        runMigration migrateAll
        insert_ $ Ellipses (toRational xPos)
                           (toRational yPos)
                           stroke

-- | Inserts a rect entry into the rects table.
insertRectIntoDB :: String -> Float -> Float -> Float -> Float -> Style -> IO ()
insertRectIntoDB id_ width height xPos yPos style = 
    runSqlite dbStr $ do
        runMigration migrateAll
        insert_ $ Rects 1
                        id_
                        (toRational width)
                        (toRational height)
                        (toRational xPos)
                        (toRational yPos)
                        (fill style)
                        (stroke style)
                        (fillOpacity style)

-- | Inserts a text entry into the texts table.
insertTextIntoDB :: String -> Float -> Float -> String -> Style -> IO ()
insertTextIntoDB id_ xPos yPos text style = 
    runSqlite dbStr $ do
        runMigration migrateAll
        insert_ $ Texts 1
                        id_
                        (toRational xPos)
                        (toRational yPos)
                        text
                        (fontSize style)
                        (fontWeight style)
                        (fontFamily style)

-- | Inserts a tex entry into the texts table.
insertPathIntoDB :: [(Float, Float)] -> Style -> IO ()
insertPathIntoDB d style = 
    runSqlite dbStr $ do
        runMigration migrateAll
        insert_ $ Paths (map (Point . convertFloatTupToRationalTup) d)
                        (fill style)
                        (fillOpacity style)
                        (stroke style)
