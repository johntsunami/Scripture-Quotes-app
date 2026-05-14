#!/usr/bin/env python3
"""
build_bible_kjv_deck.py
========================
Renders the KJV essentials deck to assets/decks/bible-kjv-essentials.json.

KJV is in the public domain worldwide. Verse selection is a curated list of
the most-loved, most-quoted verses spanning all 66 books, with emphasis on
Psalms, Proverbs, the Gospels, and Paul's epistles.

To extend: add tuples to VERSES below in the form
  (reference, text, theme)
where 'theme' becomes a tag.

Run with:  python3 scripts/build_bible_kjv_deck.py
"""

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets" / "decks" / "bible-kjv-essentials.json"

# Each entry: (reference, KJV text, primary theme tag)
# Themes: peace, strength, hope, love, faith, wisdom, guidance, comfort,
# salvation, praise, joy, courage, identity, prayer, forgiveness, provision
VERSES = [
    # ===== Foundational / Most-Quoted =====
    ("John 3:16", "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", "love"),
    ("Romans 8:28", "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.", "hope"),
    ("Philippians 4:13", "I can do all things through Christ which strengtheneth me.", "strength"),
    ("Jeremiah 29:11", "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.", "hope"),
    ("Proverbs 3:5", "Trust in the LORD with all thine heart; and lean not unto thine own understanding.", "faith"),
    ("Proverbs 3:6", "In all thy ways acknowledge him, and he shall direct thy paths.", "guidance"),
    ("Isaiah 41:10", "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.", "courage"),
    ("Psalm 23:1", "The LORD is my shepherd; I shall not want.", "provision"),
    ("Psalm 23:4", "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.", "comfort"),
    ("Joshua 1:9", "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.", "courage"),
    ("Matthew 11:28", "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", "comfort"),
    ("2 Corinthians 5:17", "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.", "identity"),
    ("Galatians 2:20", "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.", "identity"),
    ("Romans 12:2", "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.", "wisdom"),
    ("Ephesians 2:8", "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.", "salvation"),
    ("Ephesians 2:9", "Not of works, lest any man should boast.", "salvation"),
    ("Hebrews 11:1", "Now faith is the substance of things hoped for, the evidence of things not seen.", "faith"),
    ("Hebrews 13:5", "Let your conversation be without covetousness; and be content with such things as ye have: for he hath said, I will never leave thee, nor forsake thee.", "comfort"),
    ("Hebrews 13:8", "Jesus Christ the same yesterday, and to day, and for ever.", "faith"),
    ("Matthew 6:33", "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.", "guidance"),

    # ===== Genesis =====
    ("Genesis 1:1", "In the beginning God created the heaven and the earth.", "praise"),
    ("Genesis 1:27", "So God created man in his own image, in the image of God created he him; male and female created he them.", "identity"),
    ("Genesis 1:31", "And God saw every thing that he had made, and, behold, it was very good.", "praise"),
    ("Genesis 2:7", "And the LORD God formed man of the dust of the ground, and breathed into his nostrils the breath of life; and man became a living soul.", "identity"),
    ("Genesis 12:2", "And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing.", "hope"),
    ("Genesis 15:6", "And he believed in the LORD; and he counted it to him for righteousness.", "faith"),
    ("Genesis 18:14", "Is any thing too hard for the LORD?", "faith"),
    ("Genesis 28:15", "And, behold, I am with thee, and will keep thee in all places whither thou goest, and will bring thee again into this land; for I will not leave thee, until I have done that which I have spoken to thee of.", "comfort"),
    ("Genesis 50:20", "But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive.", "hope"),

    # ===== Exodus =====
    ("Exodus 3:14", "And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you.", "identity"),
    ("Exodus 14:14", "The LORD shall fight for you, and ye shall hold your peace.", "peace"),
    ("Exodus 15:2", "The LORD is my strength and song, and he is become my salvation: he is my God, and I will prepare him an habitation; my father's God, and I will exalt him.", "strength"),
    ("Exodus 20:3", "Thou shalt have no other gods before me.", "wisdom"),
    ("Exodus 33:14", "And he said, My presence shall go with thee, and I will give thee rest.", "comfort"),

    # ===== Deuteronomy =====
    ("Deuteronomy 6:5", "And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might.", "love"),
    ("Deuteronomy 31:6", "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.", "courage"),
    ("Deuteronomy 31:8", "And the LORD, he it is that doth go before thee; he will be with thee, he will not fail thee, neither forsake thee: fear not, neither be dismayed.", "courage"),

    # ===== Joshua =====
    ("Joshua 1:8", "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success.", "wisdom"),
    ("Joshua 24:15", "And if it seem evil unto you to serve the LORD, choose you this day whom ye will serve... but as for me and my house, we will serve the LORD.", "faith"),

    # ===== 1 Samuel =====
    ("1 Samuel 16:7", "But the LORD said unto Samuel, Look not on his countenance, or on the height of his stature; because I have refused him: for the LORD seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart.", "identity"),
    ("1 Samuel 17:47", "And all this assembly shall know that the LORD saveth not with sword and spear: for the battle is the LORD'S.", "courage"),

    # ===== 2 Samuel =====
    ("2 Samuel 22:31", "As for God, his way is perfect; the word of the LORD is tried: he is a buckler to all them that trust in him.", "faith"),

    # ===== 1 Kings =====
    ("1 Kings 8:23", "LORD God of Israel, there is no God like thee, in heaven above, or on earth beneath, who keepest covenant and mercy with thy servants that walk before thee with all their heart.", "praise"),

    # ===== 1 Chronicles =====
    ("1 Chronicles 16:11", "Seek the LORD and his strength, seek his face continually.", "guidance"),
    ("1 Chronicles 29:11", "Thine, O LORD, is the greatness, and the power, and the glory, and the victory, and the majesty: for all that is in the heaven and in the earth is thine.", "praise"),

    # ===== 2 Chronicles =====
    ("2 Chronicles 7:14", "If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.", "prayer"),

    # ===== Nehemiah =====
    ("Nehemiah 8:10", "Go your way, eat the fat, and drink the sweet, and send portions unto them for whom nothing is prepared: for this day is holy unto our Lord: neither be ye sorry; for the joy of the LORD is your strength.", "joy"),

    # ===== Job =====
    ("Job 19:25", "For I know that my redeemer liveth, and that he shall stand at the latter day upon the earth.", "hope"),
    ("Job 23:10", "But he knoweth the way that I take: when he hath tried me, I shall come forth as gold.", "hope"),

    # ===== Psalms (heavy emphasis - the prayerbook of the church) =====
    ("Psalm 1:1", "Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful.", "wisdom"),
    ("Psalm 1:2", "But his delight is in the law of the LORD; and in his law doth he meditate day and night.", "wisdom"),
    ("Psalm 1:3", "And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper.", "hope"),
    ("Psalm 3:3", "But thou, O LORD, art a shield for me; my glory, and the lifter up of mine head.", "comfort"),
    ("Psalm 4:8", "I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.", "peace"),
    ("Psalm 5:3", "My voice shalt thou hear in the morning, O LORD; in the morning will I direct my prayer unto thee, and will look up.", "prayer"),
    ("Psalm 8:3", "When I consider thy heavens, the work of thy fingers, the moon and the stars, which thou hast ordained;", "praise"),
    ("Psalm 8:4", "What is man, that thou art mindful of him? and the son of man, that thou visitest him?", "identity"),
    ("Psalm 16:8", "I have set the LORD always before me: because he is at my right hand, I shall not be moved.", "faith"),
    ("Psalm 16:11", "Thou wilt shew me the path of life: in thy presence is fulness of joy; at thy right hand there are pleasures for evermore.", "joy"),
    ("Psalm 18:2", "The LORD is my rock, and my fortress, and my deliverer; my God, my strength, in whom I will trust.", "strength"),
    ("Psalm 19:1", "The heavens declare the glory of God; and the firmament sheweth his handywork.", "praise"),
    ("Psalm 19:14", "Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight, O LORD, my strength, and my redeemer.", "prayer"),
    ("Psalm 20:7", "Some trust in chariots, and some in horses: but we will remember the name of the LORD our God.", "faith"),
    ("Psalm 23:2", "He maketh me to lie down in green pastures: he leadeth me beside the still waters.", "peace"),
    ("Psalm 23:3", "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.", "comfort"),
    ("Psalm 23:5", "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.", "provision"),
    ("Psalm 23:6", "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.", "hope"),
    ("Psalm 25:4", "Shew me thy ways, O LORD; teach me thy paths.", "guidance"),
    ("Psalm 25:5", "Lead me in thy truth, and teach me: for thou art the God of my salvation; on thee do I wait all the day.", "guidance"),
    ("Psalm 27:1", "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?", "courage"),
    ("Psalm 27:14", "Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD.", "courage"),
    ("Psalm 28:7", "The LORD is my strength and my shield; my heart trusted in him, and I am helped: therefore my heart greatly rejoiceth; and with my song will I praise him.", "strength"),
    ("Psalm 29:11", "The LORD will give strength unto his people; the LORD will bless his people with peace.", "peace"),
    ("Psalm 30:5", "For his anger endureth but a moment; in his favour is life: weeping may endure for a night, but joy cometh in the morning.", "joy"),
    ("Psalm 31:24", "Be of good courage, and he shall strengthen your heart, all ye that hope in the LORD.", "courage"),
    ("Psalm 32:8", "I will instruct thee and teach thee in the way which thou shalt go: I will guide thee with mine eye.", "guidance"),
    ("Psalm 34:1", "I will bless the LORD at all times: his praise shall continually be in my mouth.", "praise"),
    ("Psalm 34:4", "I sought the LORD, and he heard me, and delivered me from all my fears.", "comfort"),
    ("Psalm 34:8", "O taste and see that the LORD is good: blessed is the man that trusteth in him.", "faith"),
    ("Psalm 34:18", "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.", "comfort"),
    ("Psalm 37:4", "Delight thyself also in the LORD; and he shall give thee the desires of thine heart.", "joy"),
    ("Psalm 37:5", "Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.", "faith"),
    ("Psalm 37:7", "Rest in the LORD, and wait patiently for him: fret not thyself because of him who prospereth in his way.", "peace"),
    ("Psalm 37:23", "The steps of a good man are ordered by the LORD: and he delighteth in his way.", "guidance"),
    ("Psalm 40:1", "I waited patiently for the LORD; and he inclined unto me, and heard my cry.", "prayer"),
    ("Psalm 42:1", "As the hart panteth after the water brooks, so panteth my soul after thee, O God.", "prayer"),
    ("Psalm 42:11", "Why art thou cast down, O my soul? and why art thou disquieted within me? hope thou in God: for I shall yet praise him, who is the health of my countenance, and my God.", "hope"),
    ("Psalm 46:1", "God is our refuge and strength, a very present help in trouble.", "strength"),
    ("Psalm 46:10", "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.", "peace"),
    ("Psalm 51:10", "Create in me a clean heart, O God; and renew a right spirit within me.", "forgiveness"),
    ("Psalm 51:12", "Restore unto me the joy of thy salvation; and uphold me with thy free spirit.", "joy"),
    ("Psalm 55:22", "Cast thy burden upon the LORD, and he shall sustain thee: he shall never suffer the righteous to be moved.", "comfort"),
    ("Psalm 56:3", "What time I am afraid, I will trust in thee.", "faith"),
    ("Psalm 62:1", "Truly my soul waiteth upon God: from him cometh my salvation.", "peace"),
    ("Psalm 62:5", "My soul, wait thou only upon God; for my expectation is from him.", "hope"),
    ("Psalm 63:1", "O God, thou art my God; early will I seek thee: my soul thirsteth for thee, my flesh longeth for thee in a dry and thirsty land, where no water is.", "prayer"),
    ("Psalm 66:19", "But verily God hath heard me; he hath attended to the voice of my prayer.", "prayer"),
    ("Psalm 73:26", "My flesh and my heart faileth: but God is the strength of my heart, and my portion for ever.", "strength"),
    ("Psalm 84:11", "For the LORD God is a sun and shield: the LORD will give grace and glory: no good thing will he withhold from them that walk uprightly.", "provision"),
    ("Psalm 90:12", "So teach us to number our days, that we may apply our hearts unto wisdom.", "wisdom"),
    ("Psalm 91:1", "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.", "comfort"),
    ("Psalm 91:2", "I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.", "faith"),
    ("Psalm 91:11", "For he shall give his angels charge over thee, to keep thee in all thy ways.", "comfort"),
    ("Psalm 94:19", "In the multitude of my thoughts within me thy comforts delight my soul.", "peace"),
    ("Psalm 95:6", "O come, let us worship and bow down: let us kneel before the LORD our maker.", "praise"),
    ("Psalm 100:3", "Know ye that the LORD he is God: it is he that hath made us, and not we ourselves; we are his people, and the sheep of his pasture.", "identity"),
    ("Psalm 100:4", "Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.", "praise"),
    ("Psalm 103:1", "Bless the LORD, O my soul: and all that is within me, bless his holy name.", "praise"),
    ("Psalm 103:2", "Bless the LORD, O my soul, and forget not all his benefits.", "praise"),
    ("Psalm 103:8", "The LORD is merciful and gracious, slow to anger, and plenteous in mercy.", "love"),
    ("Psalm 103:12", "As far as the east is from the west, so far hath he removed our transgressions from us.", "forgiveness"),
    ("Psalm 116:1", "I love the LORD, because he hath heard my voice and my supplications.", "prayer"),
    ("Psalm 118:24", "This is the day which the LORD hath made; we will rejoice and be glad in it.", "joy"),
    ("Psalm 119:11", "Thy word have I hid in mine heart, that I might not sin against thee.", "wisdom"),
    ("Psalm 119:105", "Thy word is a lamp unto my feet, and a light unto my path.", "guidance"),
    ("Psalm 121:1", "I will lift up mine eyes unto the hills, from whence cometh my help.", "comfort"),
    ("Psalm 121:2", "My help cometh from the LORD, which made heaven and earth.", "provision"),
    ("Psalm 121:7", "The LORD shall preserve thee from all evil: he shall preserve thy soul.", "comfort"),
    ("Psalm 121:8", "The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore.", "comfort"),
    ("Psalm 126:5", "They that sow in tears shall reap in joy.", "hope"),
    ("Psalm 127:1", "Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain.", "wisdom"),
    ("Psalm 130:5", "I wait for the LORD, my soul doth wait, and in his word do I hope.", "hope"),
    ("Psalm 133:1", "Behold, how good and how pleasant it is for brethren to dwell together in unity!", "love"),
    ("Psalm 138:8", "The LORD will perfect that which concerneth me: thy mercy, O LORD, endureth for ever: forsake not the works of thine own hands.", "hope"),
    ("Psalm 139:1", "O LORD, thou hast searched me, and known me.", "identity"),
    ("Psalm 139:14", "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.", "identity"),
    ("Psalm 139:23", "Search me, O God, and know my heart: try me, and know my thoughts.", "prayer"),
    ("Psalm 139:24", "And see if there be any wicked way in me, and lead me in the way everlasting.", "prayer"),
    ("Psalm 143:8", "Cause me to hear thy lovingkindness in the morning; for in thee do I trust: cause me to know the way wherein I should walk; for I lift up my soul unto thee.", "guidance"),
    ("Psalm 145:18", "The LORD is nigh unto all them that call upon him, to all that call upon him in truth.", "prayer"),
    ("Psalm 147:3", "He healeth the broken in heart, and bindeth up their wounds.", "comfort"),

    # ===== Proverbs (wisdom literature - heavy emphasis) =====
    ("Proverbs 1:7", "The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction.", "wisdom"),
    ("Proverbs 2:6", "For the LORD giveth wisdom: out of his mouth cometh knowledge and understanding.", "wisdom"),
    ("Proverbs 3:7", "Be not wise in thine own eyes: fear the LORD, and depart from evil.", "wisdom"),
    ("Proverbs 3:9", "Honour the LORD with thy substance, and with the firstfruits of all thine increase.", "praise"),
    ("Proverbs 3:11", "My son, despise not the chastening of the LORD; neither be weary of his correction.", "wisdom"),
    ("Proverbs 3:13", "Happy is the man that findeth wisdom, and the man that getteth understanding.", "wisdom"),
    ("Proverbs 4:7", "Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.", "wisdom"),
    ("Proverbs 4:23", "Keep thy heart with all diligence; for out of it are the issues of life.", "wisdom"),
    ("Proverbs 9:10", "The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding.", "wisdom"),
    ("Proverbs 10:9", "He that walketh uprightly walketh surely: but he that perverteth his ways shall be known.", "wisdom"),
    ("Proverbs 11:25", "The liberal soul shall be made fat: and he that watereth shall be watered also himself.", "love"),
    ("Proverbs 12:25", "Heaviness in the heart of man maketh it stoop: but a good word maketh it glad.", "comfort"),
    ("Proverbs 13:20", "He that walketh with wise men shall be wise: but a companion of fools shall be destroyed.", "wisdom"),
    ("Proverbs 14:12", "There is a way which seemeth right unto a man, but the end thereof are the ways of death.", "wisdom"),
    ("Proverbs 15:1", "A soft answer turneth away wrath: but grievous words stir up anger.", "wisdom"),
    ("Proverbs 15:13", "A merry heart maketh a cheerful countenance: but by sorrow of the heart the spirit is broken.", "joy"),
    ("Proverbs 16:3", "Commit thy works unto the LORD, and thy thoughts shall be established.", "guidance"),
    ("Proverbs 16:9", "A man's heart deviseth his way: but the LORD directeth his steps.", "guidance"),
    ("Proverbs 16:18", "Pride goeth before destruction, and an haughty spirit before a fall.", "wisdom"),
    ("Proverbs 16:24", "Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.", "comfort"),
    ("Proverbs 17:17", "A friend loveth at all times, and a brother is born for adversity.", "love"),
    ("Proverbs 17:22", "A merry heart doeth good like a medicine: but a broken spirit drieth the bones.", "joy"),
    ("Proverbs 18:10", "The name of the LORD is a strong tower: the righteous runneth into it, and is safe.", "comfort"),
    ("Proverbs 18:24", "A man that hath friends must shew himself friendly: and there is a friend that sticketh closer than a brother.", "love"),
    ("Proverbs 19:21", "There are many devices in a man's heart; nevertheless the counsel of the LORD, that shall stand.", "guidance"),
    ("Proverbs 21:3", "To do justice and judgment is more acceptable to the LORD than sacrifice.", "wisdom"),
    ("Proverbs 22:1", "A good name is rather to be chosen than great riches, and loving favour rather than silver and gold.", "wisdom"),
    ("Proverbs 22:6", "Train up a child in the way he should go: and when he is old, he will not depart from it.", "guidance"),
    ("Proverbs 23:7", "For as he thinketh in his heart, so is he.", "wisdom"),
    ("Proverbs 24:16", "For a just man falleth seven times, and riseth up again: but the wicked shall fall into mischief.", "hope"),
    ("Proverbs 27:17", "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.", "love"),
    ("Proverbs 28:13", "He that covereth his sins shall not prosper: but whoso confesseth and forsaketh them shall have mercy.", "forgiveness"),
    ("Proverbs 29:25", "The fear of man bringeth a snare: but whoso putteth his trust in the LORD shall be safe.", "courage"),
    ("Proverbs 30:5", "Every word of God is pure: he is a shield unto them that put their trust in him.", "faith"),
    ("Proverbs 31:25", "Strength and honour are her clothing; and she shall rejoice in time to come.", "strength"),
    ("Proverbs 31:30", "Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be praised.", "wisdom"),

    # ===== Ecclesiastes =====
    ("Ecclesiastes 3:1", "To every thing there is a season, and a time to every purpose under the heaven.", "wisdom"),
    ("Ecclesiastes 3:11", "He hath made every thing beautiful in his time: also he hath set the world in their heart, so that no man can find out the work that God maketh from the beginning to the end.", "hope"),
    ("Ecclesiastes 4:9", "Two are better than one; because they have a good reward for their labour.", "love"),
    ("Ecclesiastes 4:12", "And if one prevail against him, two shall withstand him; and a threefold cord is not quickly broken.", "love"),
    ("Ecclesiastes 7:8", "Better is the end of a thing than the beginning thereof: and the patient in spirit is better than the proud in spirit.", "wisdom"),
    ("Ecclesiastes 9:10", "Whatsoever thy hand findeth to do, do it with thy might; for there is no work, nor device, nor knowledge, nor wisdom, in the grave, whither thou goest.", "wisdom"),
    ("Ecclesiastes 12:13", "Let us hear the conclusion of the whole matter: Fear God, and keep his commandments: for this is the whole duty of man.", "wisdom"),

    # ===== Song of Solomon =====
    ("Song of Solomon 2:4", "He brought me to the banqueting house, and his banner over me was love.", "love"),
    ("Song of Solomon 8:7", "Many waters cannot quench love, neither can the floods drown it: if a man would give all the substance of his house for love, it would utterly be contemned.", "love"),

    # ===== Isaiah =====
    ("Isaiah 1:18", "Come now, and let us reason together, saith the LORD: though your sins be as scarlet, they shall be as white as snow; though they be red like crimson, they shall be as wool.", "forgiveness"),
    ("Isaiah 6:8", "Also I heard the voice of the Lord, saying, Whom shall I send, and who will go for us? Then said I, Here am I; send me.", "courage"),
    ("Isaiah 9:6", "For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.", "praise"),
    ("Isaiah 12:2", "Behold, God is my salvation; I will trust, and not be afraid: for the LORD JEHOVAH is my strength and my song; he also is become my salvation.", "salvation"),
    ("Isaiah 26:3", "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.", "peace"),
    ("Isaiah 26:4", "Trust ye in the LORD for ever: for in the LORD JEHOVAH is everlasting strength.", "strength"),
    ("Isaiah 30:15", "For thus saith the Lord GOD, the Holy One of Israel; In returning and rest shall ye be saved; in quietness and in confidence shall be your strength.", "peace"),
    ("Isaiah 40:8", "The grass withereth, the flower fadeth: but the word of our God shall stand for ever.", "faith"),
    ("Isaiah 40:28", "Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding.", "praise"),
    ("Isaiah 40:29", "He giveth power to the faint; and to them that have no might he increaseth strength.", "strength"),
    ("Isaiah 40:30", "Even the youths shall faint and be weary, and the young men shall utterly fall:", "strength"),
    ("Isaiah 40:31", "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.", "strength"),
    ("Isaiah 41:13", "For I the LORD thy God will hold thy right hand, saying unto thee, Fear not; I will help thee.", "comfort"),
    ("Isaiah 43:1", "But now thus saith the LORD that created thee, O Jacob, and he that formed thee, O Israel, Fear not: for I have redeemed thee, I have called thee by thy name; thou art mine.", "identity"),
    ("Isaiah 43:2", "When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee: when thou walkest through the fire, thou shalt not be burned; neither shall the flame kindle upon thee.", "comfort"),
    ("Isaiah 43:18", "Remember ye not the former things, neither consider the things of old.", "hope"),
    ("Isaiah 43:19", "Behold, I will do a new thing; now it shall spring forth; shall ye not know it? I will even make a way in the wilderness, and rivers in the desert.", "hope"),
    ("Isaiah 53:5", "But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.", "salvation"),
    ("Isaiah 53:6", "All we like sheep have gone astray; we have turned every one to his own way; and the LORD hath laid on him the iniquity of us all.", "salvation"),
    ("Isaiah 54:10", "For the mountains shall depart, and the hills be removed; but my kindness shall not depart from thee, neither shall the covenant of my peace be removed, saith the LORD that hath mercy on thee.", "love"),
    ("Isaiah 54:17", "No weapon that is formed against thee shall prosper; and every tongue that shall rise against thee in judgment thou shalt condemn.", "comfort"),
    ("Isaiah 55:6", "Seek ye the LORD while he may be found, call ye upon him while he is near.", "guidance"),
    ("Isaiah 55:8", "For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD.", "wisdom"),
    ("Isaiah 55:9", "For as the heavens are higher than the earth, so are my ways higher than your ways, and my thoughts than your thoughts.", "wisdom"),
    ("Isaiah 55:11", "So shall my word be that goeth forth out of my mouth: it shall not return unto me void, but it shall accomplish that which I please, and it shall prosper in the thing whereto I sent it.", "faith"),
    ("Isaiah 60:1", "Arise, shine; for thy light is come, and the glory of the LORD is risen upon thee.", "hope"),

    # ===== Jeremiah =====
    ("Jeremiah 1:5", "Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee, and I ordained thee a prophet unto the nations.", "identity"),
    ("Jeremiah 17:7", "Blessed is the man that trusteth in the LORD, and whose hope the LORD is.", "faith"),
    ("Jeremiah 17:8", "For he shall be as a tree planted by the waters, and that spreadeth out her roots by the river, and shall not see when heat cometh, but her leaf shall be green; and shall not be careful in the year of drought, neither shall cease from yielding fruit.", "hope"),
    ("Jeremiah 29:12", "Then shall ye call upon me, and ye shall go and pray unto me, and I will hearken unto you.", "prayer"),
    ("Jeremiah 29:13", "And ye shall seek me, and find me, when ye shall search for me with all your heart.", "guidance"),
    ("Jeremiah 31:3", "The LORD hath appeared of old unto me, saying, Yea, I have loved thee with an everlasting love: therefore with lovingkindness have I drawn thee.", "love"),
    ("Jeremiah 33:3", "Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.", "prayer"),

    # ===== Lamentations =====
    ("Lamentations 3:22", "It is of the LORD'S mercies that we are not consumed, because his compassions fail not.", "hope"),
    ("Lamentations 3:23", "They are new every morning: great is thy faithfulness.", "hope"),
    ("Lamentations 3:25", "The LORD is good unto them that wait for him, to the soul that seeketh him.", "hope"),

    # ===== Ezekiel =====
    ("Ezekiel 36:26", "A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh, and I will give you an heart of flesh.", "identity"),

    # ===== Daniel =====
    ("Daniel 2:21", "And he changeth the times and the seasons: he removeth kings, and setteth up kings: he giveth wisdom unto the wise, and knowledge to them that know understanding.", "wisdom"),
    ("Daniel 3:17", "If it be so, our God whom we serve is able to deliver us from the burning fiery furnace, and he will deliver us out of thine hand, O king.", "faith"),

    # ===== Habakkuk =====
    ("Habakkuk 3:19", "The LORD God is my strength, and he will make my feet like hinds' feet, and he will make me to walk upon mine high places.", "strength"),

    # ===== Zephaniah =====
    ("Zephaniah 3:17", "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.", "love"),

    # ===== Zechariah =====
    ("Zechariah 4:6", "Then he answered and spake unto me, saying, This is the word of the LORD unto Zerubbabel, saying, Not by might, nor by power, but by my spirit, saith the LORD of hosts.", "strength"),

    # ===== Malachi =====
    ("Malachi 3:10", "Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the LORD of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it.", "provision"),

    # ===== Matthew =====
    ("Matthew 4:4", "But he answered and said, It is written, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.", "wisdom"),
    ("Matthew 5:3", "Blessed are the poor in spirit: for theirs is the kingdom of heaven.", "wisdom"),
    ("Matthew 5:4", "Blessed are they that mourn: for they shall be comforted.", "comfort"),
    ("Matthew 5:5", "Blessed are the meek: for they shall inherit the earth.", "wisdom"),
    ("Matthew 5:6", "Blessed are they which do hunger and thirst after righteousness: for they shall be filled.", "wisdom"),
    ("Matthew 5:7", "Blessed are the merciful: for they shall obtain mercy.", "forgiveness"),
    ("Matthew 5:8", "Blessed are the pure in heart: for they shall see God.", "wisdom"),
    ("Matthew 5:9", "Blessed are the peacemakers: for they shall be called the children of God.", "peace"),
    ("Matthew 5:14", "Ye are the light of the world. A city that is set on an hill cannot be hid.", "identity"),
    ("Matthew 5:16", "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.", "wisdom"),
    ("Matthew 5:44", "But I say unto you, Love your enemies, bless them that curse you, do good to them that hate you, and pray for them which despitefully use you, and persecute you.", "love"),
    ("Matthew 6:6", "But thou, when thou prayest, enter into thy closet, and when thou hast shut thy door, pray to thy Father which is in heaven; and thy Father which seeth in secret shall reward thee openly.", "prayer"),
    ("Matthew 6:14", "For if ye forgive men their trespasses, your heavenly Father will also forgive you.", "forgiveness"),
    ("Matthew 6:19", "Lay not up for yourselves treasures upon earth, where moth and rust doth corrupt, and where thieves break through and steal.", "wisdom"),
    ("Matthew 6:20", "But lay up for yourselves treasures in heaven, where neither moth nor rust doth corrupt, and where thieves do not break through nor steal.", "wisdom"),
    ("Matthew 6:21", "For where your treasure is, there will your heart be also.", "wisdom"),
    ("Matthew 6:25", "Therefore I say unto you, Take no thought for your life, what ye shall eat, or what ye shall drink; nor yet for your body, what ye shall put on. Is not the life more than meat, and the body than raiment?", "peace"),
    ("Matthew 6:26", "Behold the fowls of the air: for they sow not, neither do they reap, nor gather into barns; yet your heavenly Father feedeth them. Are ye not much better than they?", "provision"),
    ("Matthew 6:34", "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof.", "peace"),
    ("Matthew 7:7", "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.", "prayer"),
    ("Matthew 7:8", "For every one that asketh receiveth; and he that seeketh findeth; and to him that knocketh it shall be opened.", "prayer"),
    ("Matthew 7:12", "Therefore all things whatsoever ye would that men should do to you, do ye even so to them: for this is the law and the prophets.", "wisdom"),
    ("Matthew 11:29", "Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls.", "comfort"),
    ("Matthew 11:30", "For my yoke is easy, and my burden is light.", "comfort"),
    ("Matthew 16:24", "Then said Jesus unto his disciples, If any man will come after me, let him deny himself, and take up his cross, and follow me.", "faith"),
    ("Matthew 16:26", "For what is a man profited, if he shall gain the whole world, and lose his own soul? or what shall a man give in exchange for his soul?", "wisdom"),
    ("Matthew 18:20", "For where two or three are gathered together in my name, there am I in the midst of them.", "comfort"),
    ("Matthew 19:26", "But Jesus beheld them, and said unto them, With men this is impossible; but with God all things are possible.", "faith"),
    ("Matthew 22:37", "Jesus said unto him, Thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind.", "love"),
    ("Matthew 22:39", "And the second is like unto it, Thou shalt love thy neighbour as thyself.", "love"),
    ("Matthew 28:19", "Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:", "faith"),
    ("Matthew 28:20", "Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.", "comfort"),

    # ===== Mark =====
    ("Mark 9:23", "Jesus said unto him, If thou canst believe, all things are possible to him that believeth.", "faith"),
    ("Mark 10:27", "And Jesus looking upon them saith, With men it is impossible, but not with God: for with God all things are possible.", "faith"),
    ("Mark 11:24", "Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.", "prayer"),
    ("Mark 12:30", "And thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind, and with all thy strength: this is the first commandment.", "love"),

    # ===== Luke =====
    ("Luke 1:37", "For with God nothing shall be impossible.", "faith"),
    ("Luke 6:31", "And as ye would that men should do to you, do ye also to them likewise.", "wisdom"),
    ("Luke 6:38", "Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom. For with the same measure that ye mete withal it shall be measured to you again.", "provision"),
    ("Luke 11:9", "And I say unto you, Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.", "prayer"),
    ("Luke 12:32", "Fear not, little flock; for it is your Father's good pleasure to give you the kingdom.", "courage"),

    # ===== John =====
    ("John 1:1", "In the beginning was the Word, and the Word was with God, and the Word was God.", "praise"),
    ("John 1:5", "And the light shineth in darkness; and the darkness comprehended it not.", "hope"),
    ("John 1:12", "But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name:", "identity"),
    ("John 3:17", "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.", "salvation"),
    ("John 4:14", "But whosoever drinketh of the water that I shall give him shall never thirst; but the water that I shall give him shall be in him a well of water springing up into everlasting life.", "salvation"),
    ("John 6:35", "And Jesus said unto them, I am the bread of life: he that cometh to me shall never hunger; and he that believeth on me shall never thirst.", "salvation"),
    ("John 8:12", "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.", "guidance"),
    ("John 8:32", "And ye shall know the truth, and the truth shall make you free.", "wisdom"),
    ("John 8:36", "If the Son therefore shall make you free, ye shall be free indeed.", "salvation"),
    ("John 10:10", "The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly.", "salvation"),
    ("John 10:11", "I am the good shepherd: the good shepherd giveth his life for the sheep.", "love"),
    ("John 10:27", "My sheep hear my voice, and I know them, and they follow me:", "identity"),
    ("John 10:28", "And I give unto them eternal life; and they shall never perish, neither shall any man pluck them out of my hand.", "salvation"),
    ("John 11:25", "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:", "hope"),
    ("John 13:34", "A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another.", "love"),
    ("John 13:35", "By this shall all men know that ye are my disciples, if ye have love one to another.", "love"),
    ("John 14:1", "Let not your heart be troubled: ye believe in God, believe also in me.", "peace"),
    ("John 14:2", "In my Father's house are many mansions: if it were not so, I would have told you. I go to prepare a place for you.", "hope"),
    ("John 14:6", "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.", "salvation"),
    ("John 14:27", "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.", "peace"),
    ("John 15:5", "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.", "identity"),
    ("John 15:7", "If ye abide in me, and my words abide in you, ye shall ask what ye will, and it shall be done unto you.", "prayer"),
    ("John 15:13", "Greater love hath no man than this, that a man lay down his life for his friends.", "love"),
    ("John 16:33", "These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.", "peace"),

    # ===== Acts =====
    ("Acts 1:8", "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judaea, and in Samaria, and unto the uttermost part of the earth.", "strength"),
    ("Acts 4:12", "Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved.", "salvation"),
    ("Acts 16:31", "And they said, Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house.", "salvation"),
    ("Acts 17:28", "For in him we live, and move, and have our being; as certain also of your own poets have said, For we are also his offspring.", "identity"),
    ("Acts 20:35", "I have shewed you all things, how that so labouring ye ought to support the weak, and to remember the words of the Lord Jesus, how he said, It is more blessed to give than to receive.", "love"),

    # ===== Romans =====
    ("Romans 1:16", "For I am not ashamed of the gospel of Christ: for it is the power of God unto salvation to every one that believeth.", "faith"),
    ("Romans 3:23", "For all have sinned, and come short of the glory of God.", "salvation"),
    ("Romans 5:1", "Therefore being justified by faith, we have peace with God through our Lord Jesus Christ:", "peace"),
    ("Romans 5:8", "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.", "love"),
    ("Romans 6:23", "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.", "salvation"),
    ("Romans 8:1", "There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.", "identity"),
    ("Romans 8:18", "For I reckon that the sufferings of this present time are not worthy to be compared with the glory which shall be revealed in us.", "hope"),
    ("Romans 8:26", "Likewise the Spirit also helpeth our infirmities: for we know not what we should pray for as we ought: but the Spirit itself maketh intercession for us with groanings which cannot be uttered.", "prayer"),
    ("Romans 8:31", "What shall we then say to these things? If God be for us, who can be against us?", "courage"),
    ("Romans 8:37", "Nay, in all these things we are more than conquerors through him that loved us.", "strength"),
    ("Romans 8:38", "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,", "love"),
    ("Romans 8:39", "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.", "love"),
    ("Romans 10:9", "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.", "salvation"),
    ("Romans 10:13", "For whosoever shall call upon the name of the Lord shall be saved.", "salvation"),
    ("Romans 12:1", "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service.", "faith"),
    ("Romans 12:9", "Let love be without dissimulation. Abhor that which is evil; cleave to that which is good.", "love"),
    ("Romans 12:12", "Rejoicing in hope; patient in tribulation; continuing instant in prayer;", "hope"),
    ("Romans 12:21", "Be not overcome of evil, but overcome evil with good.", "wisdom"),
    ("Romans 14:8", "For whether we live, we live unto the Lord; and whether we die, we die unto the Lord: whether we live therefore, or die, we are the Lord's.", "identity"),
    ("Romans 15:13", "Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.", "hope"),

    # ===== 1 Corinthians =====
    ("1 Corinthians 1:25", "Because the foolishness of God is wiser than men; and the weakness of God is stronger than men.", "wisdom"),
    ("1 Corinthians 2:9", "But as it is written, Eye hath not seen, nor ear heard, neither have entered into the heart of man, the things which God hath prepared for them that love him.", "hope"),
    ("1 Corinthians 6:19", "What? know ye not that your body is the temple of the Holy Ghost which is in you, which ye have of God, and ye are not your own?", "identity"),
    ("1 Corinthians 9:24", "Know ye not that they which run in a race run all, but one receiveth the prize? So run, that ye may obtain.", "strength"),
    ("1 Corinthians 10:13", "There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it.", "strength"),
    ("1 Corinthians 13:4", "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,", "love"),
    ("1 Corinthians 13:5", "Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;", "love"),
    ("1 Corinthians 13:6", "Rejoiceth not in iniquity, but rejoiceth in the truth;", "love"),
    ("1 Corinthians 13:7", "Beareth all things, believeth all things, hopeth all things, endureth all things.", "love"),
    ("1 Corinthians 13:8", "Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away.", "love"),
    ("1 Corinthians 13:13", "And now abideth faith, hope, charity, these three; but the greatest of these is charity.", "love"),
    ("1 Corinthians 15:57", "But thanks be to God, which giveth us the victory through our Lord Jesus Christ.", "praise"),
    ("1 Corinthians 15:58", "Therefore, my beloved brethren, be ye stedfast, unmoveable, always abounding in the work of the Lord, forasmuch as ye know that your labour is not in vain in the Lord.", "strength"),
    ("1 Corinthians 16:13", "Watch ye, stand fast in the faith, quit you like men, be strong.", "courage"),
    ("1 Corinthians 16:14", "Let all your things be done with charity.", "love"),

    # ===== 2 Corinthians =====
    ("2 Corinthians 1:3", "Blessed be God, even the Father of our Lord Jesus Christ, the Father of mercies, and the God of all comfort;", "comfort"),
    ("2 Corinthians 1:4", "Who comforteth us in all our tribulation, that we may be able to comfort them which are in any trouble, by the comfort wherewith we ourselves are comforted of God.", "comfort"),
    ("2 Corinthians 4:7", "But we have this treasure in earthen vessels, that the excellency of the power may be of God, and not of us.", "identity"),
    ("2 Corinthians 4:16", "For which cause we faint not; but though our outward man perish, yet the inward man is renewed day by day.", "hope"),
    ("2 Corinthians 4:17", "For our light affliction, which is but for a moment, worketh for us a far more exceeding and eternal weight of glory;", "hope"),
    ("2 Corinthians 4:18", "While we look not at the things which are seen, but at the things which are not seen: for the things which are seen are temporal; but the things which are not seen are eternal.", "faith"),
    ("2 Corinthians 5:7", "(For we walk by faith, not by sight:)", "faith"),
    ("2 Corinthians 9:7", "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.", "love"),
    ("2 Corinthians 9:8", "And God is able to make all grace abound toward you; that ye, always having all sufficiency in all things, may abound to every good work:", "provision"),
    ("2 Corinthians 12:9", "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness. Most gladly therefore will I rather glory in my infirmities, that the power of Christ may rest upon me.", "strength"),
    ("2 Corinthians 12:10", "Therefore I take pleasure in infirmities, in reproaches, in necessities, in persecutions, in distresses for Christ's sake: for when I am weak, then am I strong.", "strength"),

    # ===== Galatians =====
    ("Galatians 5:1", "Stand fast therefore in the liberty wherewith Christ hath made us free, and be not entangled again with the yoke of bondage.", "salvation"),
    ("Galatians 5:13", "For, brethren, ye have been called unto liberty; only use not liberty for an occasion to the flesh, but by love serve one another.", "love"),
    ("Galatians 5:22", "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,", "joy"),
    ("Galatians 5:23", "Meekness, temperance: against such there is no law.", "wisdom"),
    ("Galatians 6:7", "Be not deceived; God is not mocked: for whatsoever a man soweth, that shall he also reap.", "wisdom"),
    ("Galatians 6:9", "And let us not be weary in well doing: for in due season we shall reap, if we faint not.", "strength"),

    # ===== Ephesians =====
    ("Ephesians 1:7", "In whom we have redemption through his blood, the forgiveness of sins, according to the riches of his grace;", "forgiveness"),
    ("Ephesians 2:10", "For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in them.", "identity"),
    ("Ephesians 3:20", "Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us,", "faith"),
    ("Ephesians 4:2", "With all lowliness and meekness, with longsuffering, forbearing one another in love;", "love"),
    ("Ephesians 4:29", "Let no corrupt communication proceed out of your mouth, but that which is good to the use of edifying, that it may minister grace unto the hearers.", "wisdom"),
    ("Ephesians 4:32", "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you.", "forgiveness"),
    ("Ephesians 5:1", "Be ye therefore followers of God, as dear children;", "identity"),
    ("Ephesians 5:2", "And walk in love, as Christ also hath loved us, and hath given himself for us an offering and a sacrifice to God for a sweetsmelling savour.", "love"),
    ("Ephesians 6:10", "Finally, my brethren, be strong in the Lord, and in the power of his might.", "strength"),
    ("Ephesians 6:11", "Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.", "strength"),
    ("Ephesians 6:13", "Wherefore take unto you the whole armour of God, that ye may be able to withstand in the evil day, and having done all, to stand.", "strength"),

    # ===== Philippians =====
    ("Philippians 1:6", "Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:", "hope"),
    ("Philippians 1:21", "For to me to live is Christ, and to die is gain.", "identity"),
    ("Philippians 2:3", "Let nothing be done through strife or vainglory; but in lowliness of mind let each esteem other better than themselves.", "wisdom"),
    ("Philippians 2:4", "Look not every man on his own things, but every man also on the things of others.", "love"),
    ("Philippians 2:14", "Do all things without murmurings and disputings:", "wisdom"),
    ("Philippians 3:13", "Brethren, I count not myself to have apprehended: but this one thing I do, forgetting those things which are behind, and reaching forth unto those things which are before,", "hope"),
    ("Philippians 3:14", "I press toward the mark for the prize of the high calling of God in Christ Jesus.", "strength"),
    ("Philippians 4:4", "Rejoice in the Lord alway: and again I say, Rejoice.", "joy"),
    ("Philippians 4:6", "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.", "prayer"),
    ("Philippians 4:7", "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.", "peace"),
    ("Philippians 4:8", "Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely, whatsoever things are of good report; if there be any virtue, and if there be any praise, think on these things.", "wisdom"),
    ("Philippians 4:11", "Not that I speak in respect of want: for I have learned, in whatsoever state I am, therewith to be content.", "peace"),
    ("Philippians 4:19", "But my God shall supply all your need according to his riches in glory by Christ Jesus.", "provision"),

    # ===== Colossians =====
    ("Colossians 1:17", "And he is before all things, and by him all things consist.", "praise"),
    ("Colossians 2:6", "As ye have therefore received Christ Jesus the Lord, so walk ye in him:", "guidance"),
    ("Colossians 2:7", "Rooted and built up in him, and stablished in the faith, as ye have been taught, abounding therein with thanksgiving.", "faith"),
    ("Colossians 3:1", "If ye then be risen with Christ, seek those things which are above, where Christ sitteth on the right hand of God.", "guidance"),
    ("Colossians 3:2", "Set your affection on things above, not on things on the earth.", "wisdom"),
    ("Colossians 3:12", "Put on therefore, as the elect of God, holy and beloved, bowels of mercies, kindness, humbleness of mind, meekness, longsuffering;", "love"),
    ("Colossians 3:13", "Forbearing one another, and forgiving one another, if any man have a quarrel against any: even as Christ forgave you, so also do ye.", "forgiveness"),
    ("Colossians 3:14", "And above all these things put on charity, which is the bond of perfectness.", "love"),
    ("Colossians 3:15", "And let the peace of God rule in your hearts, to the which also ye are called in one body; and be ye thankful.", "peace"),
    ("Colossians 3:17", "And whatsoever ye do in word or deed, do all in the name of the Lord Jesus, giving thanks to God and the Father by him.", "faith"),
    ("Colossians 3:23", "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;", "wisdom"),

    # ===== 1 Thessalonians =====
    ("1 Thessalonians 5:11", "Wherefore comfort yourselves together, and edify one another, even as also ye do.", "comfort"),
    ("1 Thessalonians 5:16", "Rejoice evermore.", "joy"),
    ("1 Thessalonians 5:17", "Pray without ceasing.", "prayer"),
    ("1 Thessalonians 5:18", "In every thing give thanks: for this is the will of God in Christ Jesus concerning you.", "praise"),

    # ===== 2 Thessalonians =====
    ("2 Thessalonians 3:3", "But the Lord is faithful, who shall stablish you, and keep you from evil.", "faith"),

    # ===== 1 Timothy =====
    ("1 Timothy 4:12", "Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity.", "identity"),
    ("1 Timothy 6:6", "But godliness with contentment is great gain.", "wisdom"),
    ("1 Timothy 6:12", "Fight the good fight of faith, lay hold on eternal life, whereunto thou art also called, and hast professed a good profession before many witnesses.", "strength"),

    # ===== 2 Timothy =====
    ("2 Timothy 1:7", "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.", "courage"),
    ("2 Timothy 2:15", "Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.", "wisdom"),
    ("2 Timothy 3:16", "All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:", "wisdom"),
    ("2 Timothy 4:7", "I have fought a good fight, I have finished my course, I have kept the faith:", "strength"),

    # ===== Titus =====
    ("Titus 3:5", "Not by works of righteousness which we have done, but according to his mercy he saved us, by the washing of regeneration, and renewing of the Holy Ghost;", "salvation"),

    # ===== Hebrews =====
    ("Hebrews 4:12", "For the word of God is quick, and powerful, and sharper than any twoedged sword, piercing even to the dividing asunder of soul and spirit, and of the joints and marrow, and is a discerner of the thoughts and intents of the heart.", "wisdom"),
    ("Hebrews 4:15", "For we have not an high priest which cannot be touched with the feeling of our infirmities; but was in all points tempted like as we are, yet without sin.", "comfort"),
    ("Hebrews 4:16", "Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need.", "prayer"),
    ("Hebrews 10:23", "Let us hold fast the profession of our faith without wavering; (for he is faithful that promised;)", "faith"),
    ("Hebrews 10:24", "And let us consider one another to provoke unto love and to good works:", "love"),
    ("Hebrews 11:6", "But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him.", "faith"),
    ("Hebrews 12:1", "Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us,", "strength"),
    ("Hebrews 12:2", "Looking unto Jesus the author and finisher of our faith; who for the joy that was set before him endured the cross, despising the shame, and is set down at the right hand of the throne of God.", "faith"),
    ("Hebrews 12:11", "Now no chastening for the present seemeth to be joyous, but grievous: nevertheless afterward it yieldeth the peaceable fruit of righteousness unto them which are exercised thereby.", "wisdom"),
    ("Hebrews 13:6", "So that we may boldly say, The Lord is my helper, and I will not fear what man shall do unto me.", "courage"),

    # ===== James =====
    ("James 1:2", "My brethren, count it all joy when ye fall into divers temptations;", "joy"),
    ("James 1:3", "Knowing this, that the trying of your faith worketh patience.", "strength"),
    ("James 1:5", "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.", "wisdom"),
    ("James 1:12", "Blessed is the man that endureth temptation: for when he is tried, he shall receive the crown of life, which the Lord hath promised to them that love him.", "strength"),
    ("James 1:17", "Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning.", "praise"),
    ("James 1:19", "Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath:", "wisdom"),
    ("James 1:22", "But be ye doers of the word, and not hearers only, deceiving your own selves.", "wisdom"),
    ("James 4:7", "Submit yourselves therefore to God. Resist the devil, and he will flee from you.", "strength"),
    ("James 4:8", "Draw nigh to God, and he will draw nigh to you. Cleanse your hands, ye sinners; and purify your hearts, ye double minded.", "prayer"),
    ("James 4:10", "Humble yourselves in the sight of the Lord, and he shall lift you up.", "wisdom"),
    ("James 5:16", "Confess your faults one to another, and pray one for another, that ye may be healed. The effectual fervent prayer of a righteous man availeth much.", "prayer"),

    # ===== 1 Peter =====
    ("1 Peter 1:3", "Blessed be the God and Father of our Lord Jesus Christ, which according to his abundant mercy hath begotten us again unto a lively hope by the resurrection of Jesus Christ from the dead,", "hope"),
    ("1 Peter 2:9", "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light;", "identity"),
    ("1 Peter 2:24", "Who his own self bare our sins in his own body on the tree, that we, being dead to sins, should live unto righteousness: by whose stripes ye were healed.", "salvation"),
    ("1 Peter 3:15", "But sanctify the Lord God in your hearts: and be ready always to give an answer to every man that asketh you a reason of the hope that is in you with meekness and fear:", "hope"),
    ("1 Peter 4:8", "And above all things have fervent charity among yourselves: for charity shall cover the multitude of sins.", "love"),
    ("1 Peter 5:6", "Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time:", "wisdom"),
    ("1 Peter 5:7", "Casting all your care upon him; for he careth for you.", "comfort"),
    ("1 Peter 5:8", "Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour:", "strength"),
    ("1 Peter 5:10", "But the God of all grace, who hath called us unto his eternal glory by Christ Jesus, after that ye have suffered a while, make you perfect, stablish, strengthen, settle you.", "strength"),

    # ===== 2 Peter =====
    ("2 Peter 1:3", "According as his divine power hath given unto us all things that pertain unto life and godliness, through the knowledge of him that hath called us to glory and virtue:", "provision"),
    ("2 Peter 3:9", "The Lord is not slack concerning his promise, as some men count slackness; but is longsuffering to us-ward, not willing that any should perish, but that all should come to repentance.", "love"),

    # ===== 1 John =====
    ("1 John 1:7", "But if we walk in the light, as he is in the light, we have fellowship one with another, and the blood of Jesus Christ his Son cleanseth us from all sin.", "forgiveness"),
    ("1 John 1:9", "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.", "forgiveness"),
    ("1 John 3:1", "Behold, what manner of love the Father hath bestowed upon us, that we should be called the sons of God: therefore the world knoweth us not, because it knew him not.", "identity"),
    ("1 John 3:18", "My little children, let us not love in word, neither in tongue; but in deed and in truth.", "love"),
    ("1 John 4:4", "Ye are of God, little children, and have overcome them: because greater is he that is in you, than he that is in the world.", "strength"),
    ("1 John 4:7", "Beloved, let us love one another: for love is of God; and every one that loveth is born of God, and knoweth God.", "love"),
    ("1 John 4:8", "He that loveth not knoweth not God; for God is love.", "love"),
    ("1 John 4:18", "There is no fear in love; but perfect love casteth out fear: because fear hath torment. He that feareth is not made perfect in love.", "love"),
    ("1 John 4:19", "We love him, because he first loved us.", "love"),
    ("1 John 5:4", "For whatsoever is born of God overcometh the world: and this is the victory that overcometh the world, even our faith.", "faith"),
    ("1 John 5:14", "And this is the confidence that we have in him, that, if we ask any thing according to his will, he heareth us:", "prayer"),

    # ===== Revelation =====
    ("Revelation 3:20", "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me.", "salvation"),
    ("Revelation 21:4", "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.", "hope"),
    ("Revelation 21:5", "And he that sat upon the throne said, Behold, I make all things new. And he said unto me, Write: for these words are true and faithful.", "hope"),
    ("Revelation 22:13", "I am Alpha and Omega, the beginning and the end, the first and the last.", "praise"),
]

def make_deck():
    quotes = []
    seen_refs = set()
    for ref, text, theme in VERSES:
        if ref in seen_refs:
            print(f"WARNING: duplicate reference {ref}", file=sys.stderr)
            continue
        seen_refs.add(ref)
        quotes.append({
            "text": text,
            "source": ref,
            "category": "scripture",
            "tags": [theme, "kjv", "bible"],
        })
    return {
        "name": "Bible — KJV Essentials",
        "description": f"{len(quotes)} of the most-loved verses across the Bible, King James Version (public domain).",
        "builtin": True,
        "version": 1,
        "quotes": quotes,
    }

if __name__ == "__main__":
    deck = make_deck()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(deck, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(deck['quotes'])} verses to {OUT}")
