@App-Calculator
Feature: Windows Calculator - Standard Mode
  As a user of the Windows Calculator
  I want to perform basic arithmetic operations
  So that I can get accurate calculation results

  Background:
    Given the active window is "Calculator"
    And the Calculator app is launched
    And the calculator is in Standard mode

  Scenario: Addition of two numbers
    When I enter the number "5"
    And I click the "plus" operator
    And I enter the number "3"
    And I click the "equals" button
    Then the result should contain "8"

  Scenario: Subtraction of two numbers
    When I enter the number "9"
    And I click the "minus" operator
    And I enter the number "4"
    And I click the "equals" button
    Then the result should contain "5"

  Scenario: Multiplication of two numbers
    When I enter the number "7"
    And I click the "multiply" operator
    And I enter the number "6"
    And I click the "equals" button
    Then the result should contain "42"

  Scenario: Division of two numbers
    When I enter the number "8"
    And I click the "divide" operator
    And I enter the number "2"
    And I click the "equals" button
    Then the result should contain "4"

  Scenario: Clear resets the display
    When I enter the number "123"
    And I click the "clear" button
    Then the result should contain "0"

  Scenario: Chained operations
    When I enter the number "2"
    And I click the "plus" operator
    And I enter the number "3"
    And I click the "multiply" operator
    And I enter the number "4"
    And I click the "equals" button
    Then the result should contain "20"
